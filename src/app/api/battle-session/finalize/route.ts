import { NextResponse } from "next/server";

import { isMockAuthEnabled } from "@/lib/auth/config";
import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  if (typeof battleId !== "string" || battleId.length === 0) {
    return NextResponse.json({ error: "missing_battleId" }, { status: 400 });
  }

  if (isMockAuthEnabled) {
    const result = {
      battle_id: battleId,
      finalized_at: new Date().toISOString(),
      counts: { 1: 0, 2: 0 },
      winner_slot: null,
      reason: "mock",
    };
    return NextResponse.json({ ok: true, mode: "mock", battleId, result });
  }

  const role = await getSessionRole();
  const supabase = await createSupabaseServerClient();

  const { data: battle, error: battleError } = await supabase
    .from("battles")
    .select("id,created_by,status,voting_opened_at,voting_closes_at")
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

  const { data: votes, error: votesError } = await supabase
    .from("battle_votes")
    .select("slot")
    .eq("battle_id", battleId);

  if (votesError) {
    return NextResponse.json(
      { error: "votes_fetch_failed", details: votesError.message },
      { status: 400 },
    );
  }

  let countA = 0;
  let countB = 0;
  for (const v of votes ?? []) {
    if (v.slot === 1) countA += 1;
    if (v.slot === 2) countB += 1;
  }

  const winnerSlot = countA === countB ? null : countA > countB ? 1 : 2;

  const finalizedAt = new Date().toISOString();
  const result = {
    battle_id: battleId,
    finalized_at: finalizedAt,
    counts: { 1: countA, 2: countB },
    winner_slot: winnerSlot,
  };

  const { error: updateParticipantsError } = await supabase
    .from("battle_participants")
    .update({ score: null })
    .eq("battle_id", battleId);

  if (updateParticipantsError) {
    return NextResponse.json(
      {
        error: "participant_update_failed",
        details: updateParticipantsError.message,
      },
      { status: 400 },
    );
  }

  const { data: participants, error: participantsError } = await supabase
    .from("battle_participants")
    .select("id,slot")
    .eq("battle_id", battleId);

  if (participantsError) {
    return NextResponse.json(
      { error: "participants_fetch_failed", details: participantsError.message },
      { status: 400 },
    );
  }

  for (const p of participants ?? []) {
    if (p.slot !== 1 && p.slot !== 2) continue;
    const score = p.slot === 1 ? countA : countB;
    const { error: scoreError } = await supabase
      .from("battle_participants")
      .update({ score })
      .eq("id", p.id);

    if (scoreError) {
      return NextResponse.json(
        { error: "participant_score_failed", details: scoreError.message },
        { status: 400 },
      );
    }
  }

  const idempotencyKey = `finalize:${battleId}:${finalizedAt}`;
  const { data: rpcData, error: rpcError } = await supabase.rpc("record_battle_result", {
    p_idempotency_key: idempotencyKey,
    p_battle_id: battleId,
    p_result: result,
  });

  if (rpcError) {
    return NextResponse.json(
      { error: "finalize_failed", details: rpcError.message },
      { status: 400 },
    );
  }

  const ratingsIdempotencyKey = `elo:${battleId}:${finalizedAt}`;
  const { data: eloData, error: eloError } = await supabase.rpc("apply_battle_elo_ratings", {
    p_idempotency_key: ratingsIdempotencyKey,
    p_battle_id: battleId,
    p_winner_slot: winnerSlot ?? 0,
  });

  if (eloError) {
    return NextResponse.json(
      { ok: true, mode: "supabase", battleId, result, rpc: rpcData, ratings_error: eloError.message },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, mode: "supabase", battleId, result, rpc: rpcData, elo: eloData });
}
