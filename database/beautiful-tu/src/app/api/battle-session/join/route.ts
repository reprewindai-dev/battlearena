import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { isTerminalBattleStatus } from "@/lib/battle/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";

type ParticipantRow = {
  user_id: string;
  slot: number;
};

async function promoteMatchedBattleToLive(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  battleId: string;
  startedAt: string | null | undefined;
}) {
  const { supabase, battleId, startedAt } = params;
  const now = new Date();
  const { data, error } = await supabase
    .from("battles")
    .update({
      status: "live",
      started_at: startedAt ?? now.toISOString(),
      current_round: 1,
      voting_opened_at: now.toISOString(),
      voting_closes_at: new Date(now.getTime() + 120_000).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", battleId)
    .eq("status", "matched")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`battle_live_promotion_failed:${error.message}`);
  }

  return Boolean(data?.id);
}

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

  const username = authData.user.email?.split("@")[0] ?? `user_${authData.user.id.slice(0, 8)}`;
  const { error: userError } = await supabase.from("users").upsert(
    {
      id: authData.user.id,
      email: authData.user.email ?? `${username}@battlearena.local`,
      username,
    },
    { onConflict: "id" },
  );

  if (userError) {
    return NextResponse.json({ error: "user_sync_failed", details: userError.message }, { status: 400 });
  }

  const userId = authData.user.id;

  const [{ data: battle, error: battleError }, { data: participants, error: participantsError }] = await Promise.all([
    supabase
      .from("battles")
      .select("id,status,is_bot_battle,started_at")
      .eq("id", battleId)
      .maybeSingle(),
    supabase.from("battle_participants").select("user_id,slot").eq("battle_id", battleId).order("slot", { ascending: true }),
  ]);

  if (battleError) {
    return NextResponse.json({ error: "battle_fetch_failed", details: battleError.message }, { status: 400 });
  }

  if (participantsError) {
    return NextResponse.json({ error: "participants_fetch_failed", details: participantsError.message }, { status: 400 });
  }

  if (!battle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (isTerminalBattleStatus(battle.status)) {
    return NextResponse.json({ error: "battle_not_joinable" }, { status: 409 });
  }

  const existingSelf = (participants ?? []).find((participant: ParticipantRow) => participant.user_id === userId);
  if (existingSelf) {
    const shouldPromote = battle.status === "matched" && (Boolean(battle.is_bot_battle) || (participants?.length ?? 0) >= 2);
    if (shouldPromote) {
      const promoted = await promoteMatchedBattleToLive({
        supabase,
        battleId,
        startedAt: battle.started_at,
      });
      if (promoted) {
        const telemetry = getTelemetrySystem();
        await telemetry
          .emitMatchStart(battleId, {
            player_a_id: participants?.find((participant: ParticipantRow) => participant.slot === 1)?.user_id ?? userId,
            player_b_id: participants?.find((participant: ParticipantRow) => participant.slot === 2)?.user_id ?? null,
            mode: "live_room_join",
            opponent_type: battle.is_bot_battle ? "bot" : "human",
            governance_tier: battle.is_bot_battle ? "fallback" : "standard",
          })
          .catch(() => null);
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "supabase",
      battleId,
      slot: existingSelf.slot,
      status: shouldPromote ? "live" : battle.status,
    });
  }

  if (battle.is_bot_battle) {
    return NextResponse.json({ error: "bot_battle_has_no_open_slot" }, { status: 409 });
  }

  const slotTwoTaken = (participants ?? []).some((participant: ParticipantRow) => participant.slot === 2);
  if (slotTwoTaken) {
    return NextResponse.json({ error: "slot_taken" }, { status: 409 });
  }

  const { error: insertError } = await supabase.from("battle_participants").insert({ battle_id: battleId, user_id: userId, slot: 2 });

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
        return NextResponse.json({ error: "join_failed", details: insertError.message }, { status: 400 });
      }

      if (existing) {
        const shouldPromote = battle.status === "matched";
        if (shouldPromote) {
          const promoted = await promoteMatchedBattleToLive({
            supabase,
            battleId,
            startedAt: battle.started_at,
          });
          if (promoted) {
            const telemetry = getTelemetrySystem();
            await telemetry
              .emitMatchStart(battleId, {
                player_a_id: participants?.find((participant: ParticipantRow) => participant.slot === 1)?.user_id ?? userId,
                player_b_id: participants?.find((participant: ParticipantRow) => participant.slot === 2)?.user_id ?? userId,
                mode: "live_room_join",
                opponent_type: battle.is_bot_battle ? "bot" : "human",
                governance_tier: battle.is_bot_battle ? "fallback" : "standard",
              })
              .catch(() => null);
          }
        }

        return NextResponse.json({
          ok: true,
          mode: "supabase",
          battleId,
          slot: existing.slot,
          status: shouldPromote ? "live" : battle.status,
        });
      }

      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }

    if (code === "23503") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ error: "join_failed", details: insertError.message }, { status: 400 });
  }

  if (battle.status === "matched") {
    const promoted = await promoteMatchedBattleToLive({
      supabase,
      battleId,
      startedAt: battle.started_at,
    });
    if (promoted) {
      const telemetry = getTelemetrySystem();
      await telemetry
        .emitMatchStart(battleId, {
          player_a_id: participants?.find((participant: ParticipantRow) => participant.slot === 1)?.user_id ?? null,
          player_b_id: userId,
          mode: "live_room_join",
          opponent_type: battle.is_bot_battle ? "bot" : "human",
          governance_tier: battle.is_bot_battle ? "fallback" : "standard",
        })
        .catch(() => null);
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "supabase",
    battleId,
    slot: 2,
    status: battle.status === "matched" ? "live" : battle.status,
  });
}
