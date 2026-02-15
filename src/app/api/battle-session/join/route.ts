import { NextResponse } from "next/server";

import { isMockAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  if (isMockAuthEnabled) {
    return NextResponse.json({ ok: true, mode: "mock", battleId, slot: 2 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = authData.user.id;

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
