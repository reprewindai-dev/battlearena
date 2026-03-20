import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { isTerminalBattleStatus } from "@/lib/battle/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ParticipantRow = {
  user_id: string;
  slot: number;
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  let battleId: string | null = null;
  if (body && typeof body === "object" && "battleId" in body) {
    const candidate = (body as Record<string, unknown>).battleId;
    if (typeof candidate === "string") {
      battleId = candidate;
    }
  }

  if (!battleId) {
    return NextResponse.json({ error: "missing_battleId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const username =
    authData.user.email?.split("@")[0] ?? `user_${authData.user.id.slice(0, 8)}`;
  const { error: userError } = await supabase.from("users").upsert(
    {
      id: authData.user.id,
      email: authData.user.email ?? `${username}@battlearena.local`,
      username,
    },
    { onConflict: "id" },
  );

  if (userError) {
    return NextResponse.json(
      { error: "user_sync_failed", details: userError.message },
      { status: 400 },
    );
  }

  const userId = authData.user.id;

  const [{ data: battle, error: battleError }, { data: participants, error: participantsError }] = await Promise.all([
    supabase
      .from("battles")
      .select("id,status,is_bot_battle")
      .eq("id", battleId)
      .maybeSingle(),
    supabase
      .from("battle_participants")
      .select("user_id,slot")
      .eq("battle_id", battleId)
      .order("slot", { ascending: true }),
  ]);

  if (battleError) {
    return NextResponse.json(
      { error: "battle_fetch_failed", details: battleError.message },
      { status: 400 },
    );
  }

  if (participantsError) {
    return NextResponse.json(
      { error: "participants_fetch_failed", details: participantsError.message },
      { status: 400 },
    );
  }

  if (!battle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (isTerminalBattleStatus(battle.status)) {
    return NextResponse.json({ error: "battle_not_joinable" }, { status: 409 });
  }

  if (battle.is_bot_battle) {
    return NextResponse.json({ error: "bot_battle_has_no_open_slot" }, { status: 409 });
  }

  const existingSelf = (participants ?? []).find((participant: ParticipantRow) => participant.user_id === userId);
  if (existingSelf) {
    return NextResponse.json({ ok: true, mode: "supabase", battleId, slot: existingSelf.slot });
  }

  const slotTwoTaken = (participants ?? []).some((participant: ParticipantRow) => participant.slot === 2);
  if (slotTwoTaken) {
    return NextResponse.json({ error: "slot_taken" }, { status: 409 });
  }

  const { error: insertError } = await supabase
    .from("battle_participants")
    .insert({ battle_id: battleId, user_id: userId, slot: 2 });

  if (insertError) {
    const code = (insertError as { code?: string }).code;

    if (code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("battle_participants")
        .select("slot")
        .eq("battle_id", battleId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingError) {
        return NextResponse.json(
          { error: "join_failed", details: insertError.message },
          { status: 400 },
        );
      }

      if (existing) {
        return NextResponse.json({ ok: true, mode: "supabase", battleId, slot: existing.slot });
      }

      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }

    if (code === "23503") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "join_failed", details: insertError.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, mode: "supabase", battleId, slot: 2 });
}
