import { NextResponse } from "next/server";

import { isMockAuthEnabled } from "@/lib/auth/config";
import { getSessionUser, getSessionRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BattleStatus = "draft" | "queued" | "live" | "complete" | "canceled";

function isValidStatus(value: unknown): value is BattleStatus {
  return (
    value === "draft" ||
    value === "queued" ||
    value === "live" ||
    value === "complete" ||
    value === "canceled"
  );
}

function isModOrAdmin(role: string | null) {
  return role === "mod" || role === "admin";
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

  if (isMockAuthEnabled) {
    return NextResponse.json({ ok: true, mode: "mock", battleId, status });
  }

  const role = await getSessionRole();
  const supabase = await createSupabaseServerClient();

  const { data: battle, error: battleError } = await supabase
    .from("battles")
    .select("id,created_by,status")
    .eq("id", battleId)
    .maybeSingle();

  if (battleError) {
    return NextResponse.json(
      { error: "battle_fetch_failed", details: battleError.message },
      { status: 400 },
    );
  }
  if (!battle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const allowed = battle.created_by === user.id || isModOrAdmin(role);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "live") {
    const now = new Date();
    patch.started_at = now.toISOString();
    patch.current_round = (battle as { current_round?: number | null }).current_round ?? 1;
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
}
