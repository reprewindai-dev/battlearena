import { NextResponse } from "next/server";

import { getSessionUser, getSessionRole } from "@/lib/auth/session";
import { canTransitionBattleStatus, loadBattleAccess } from "@/lib/battle/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BattleStatus = "draft" | "queued" | "matched" | "live" | "complete" | "canceled";

function isValidStatus(value: unknown): value is BattleStatus {
  return (
    value === "draft" ||
    value === "queued" ||
    value === "matched" ||
    value === "live" ||
    value === "complete" ||
    value === "canceled"
  );
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const battleId =
    body && typeof body === "object" && "battleId" in body
      ? ((body as Record<string, unknown>).battleId as unknown)
      : null;
  const status =
    body && typeof body === "object" && "status" in body
      ? ((body as Record<string, unknown>).status as unknown)
      : null;

  if (typeof battleId !== "string" || battleId.length === 0) {
    return NextResponse.json({ error: "missing_battleId" }, { status: 400 });
  }
  if (!isValidStatus(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const role = await getSessionRole();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const access = await loadBattleAccess({ supabase, battleId, userId: user.id, role });
    if (!access) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (!access.canManage) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (!canTransitionBattleStatus(access.battle.status, status)) {
      return NextResponse.json(
        {
          error: "invalid_status_transition",
          details: `Cannot move battle from ${access.battle.status} to ${status}`,
        },
        { status: 409 },
      );
    }

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "live") {
      const now = new Date();
      patch.started_at = access.battle.started_at ?? now.toISOString();
      patch.current_round = 1;
      patch.voting_opened_at = now.toISOString();
      patch.voting_closes_at = new Date(now.getTime() + 120_000).toISOString();
    }
    if (status === "complete" || status === "canceled") {
      const now = new Date();
      patch.ended_at = now.toISOString();
      patch.voting_closes_at = now.toISOString();
    }

    const { data: updated, error: updateError } = await supabase
      .from("battles")
      .update(patch)
      .eq("id", battleId)
      .select("id,status,started_at,ended_at,current_round,voting_opened_at,voting_closes_at")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: "battle_update_failed", details: updateError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, mode: "supabase", battle: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error: "battle_fetch_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
