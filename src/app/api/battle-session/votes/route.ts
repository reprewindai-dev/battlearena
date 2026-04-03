import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { canViewBattle, loadBattleAccess, type SessionRole } from "@/lib/battle/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type VoteSlot = 1 | 2;

function parseVoteSlot(value: unknown): VoteSlot | null {
  return value === 1 || value === 2 ? value : null;
}

function parseSessionRole(rawRole: string | null): SessionRole {
  return rawRole === "admin" || rawRole === "mod" || rawRole === "user" ? rawRole : null;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const battleId = url.searchParams.get("battleId");
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

  const rawRole =
    (authData.user.app_metadata as { role?: string } | undefined)?.role ??
    (authData.user.user_metadata as { role?: string } | undefined)?.role ??
    null;
  const role = parseSessionRole(rawRole);

  let access;
  try {
    access = await loadBattleAccess({
      supabase,
      battleId,
      userId: authData.user.id,
      role,
      select: "id,created_by,status",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "battle_access_failed", details: error instanceof Error ? error.message : "unknown" },
      { status: 400 },
    );
  }

  if (!access) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (
    !canViewBattle({
      battle: access.battle,
      userId: authData.user.id,
      isParticipant: access.isParticipant,
      canModerate: access.canModerate,
    })
  ) {
    return NextResponse.json({ error: "not_participant" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("battle_votes")
    .select("slot,voter_user_id")
    .eq("battle_id", battleId);

  if (error) {
    return NextResponse.json({ error: "votes_fetch_failed", details: error.message }, { status: 400 });
  }

  let countA = 0;
  let countB = 0;
  let myVote: VoteSlot | null = null;

  for (const r of rows ?? []) {
    if (r.slot === 1) countA += 1;
    if (r.slot === 2) countB += 1;
    if (r.voter_user_id === authData.user.id && (r.slot === 1 || r.slot === 2)) {
      myVote = r.slot;
    }
  }

  return NextResponse.json({ ok: true, mode: "supabase", counts: { 1: countA, 2: countB }, my_vote: myVote });
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
  const slotValue =
    body && typeof body === "object" && "slot" in body
      ? ((body as Record<string, unknown>).slot as unknown)
      : null;

  if (typeof battleId !== "string" || battleId.length === 0) {
    return NextResponse.json({ error: "missing_battleId" }, { status: 400 });
  }

  const slot = parseVoteSlot(slotValue);
  if (!slot) {
    return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawRole =
    (authData.user.app_metadata as { role?: string } | undefined)?.role ??
    (authData.user.user_metadata as { role?: string } | undefined)?.role ??
    null;
  const role = parseSessionRole(rawRole);

  let access;
  try {
    access = await loadBattleAccess({
      supabase,
      battleId,
      userId: authData.user.id,
      role,
      select: "id,created_by,status,voting_opened_at,voting_closes_at",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "battle_access_failed", details: error instanceof Error ? error.message : "unknown" },
      { status: 400 },
    );
  }

  if (!access) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (
    !canViewBattle({
      battle: access.battle,
      userId: authData.user.id,
      isParticipant: access.isParticipant,
      canModerate: access.canModerate,
    })
  ) {
    return NextResponse.json({ error: "not_participant" }, { status: 403 });
  }

  const closesAt = (access.battle as { voting_closes_at?: string | null }).voting_closes_at;
  const openedAt = (access.battle as { voting_opened_at?: string | null }).voting_opened_at;
  if (!openedAt || !closesAt || Date.now() > new Date(closesAt).getTime()) {
    return NextResponse.json({ error: "voting_closed" }, { status: 403 });
  }

  const { error: insertError } = await supabase.from("battle_votes").insert({
    battle_id: battleId,
    voter_user_id: authData.user.id,
    slot,
  });

  if (insertError) {
    const code = (insertError as { code?: string }).code;
    if (code === "23505") {
      return NextResponse.json({ error: "already_voted" }, { status: 409 });
    }
    return NextResponse.json({ error: "vote_create_failed", details: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, mode: "supabase", slot });
}
