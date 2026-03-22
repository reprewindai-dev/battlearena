import { NextResponse } from "next/server";

import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import { isTerminalBattleStatus, loadBattleAccess } from "@/lib/battle/access";
import { markReferralActivated } from "@/lib/growth/referrals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";

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

  const role = await getSessionRole();
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const access = await loadBattleAccess({ supabase, battleId, userId: user.id, role });
  if (!access) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!access.canManage) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (access.battle.status !== "live" && !isTerminalBattleStatus(access.battle.status)) {
    return NextResponse.json({ error: "battle_not_live" }, { status: 409 });
  }

  if (access.battle.status === "canceled") {
    return NextResponse.json({ error: "battle_canceled" }, { status: 409 });
  }

  if (access.battle.voting_closes_at && new Date(access.battle.voting_closes_at) > new Date()) {
    return NextResponse.json({ error: "voting_not_closed" }, { status: 400 });
  }

  if (access.battle.result && typeof access.battle.result === "object" && "finalized_at" in access.battle.result) {
    return NextResponse.json({ ok: true, mode: "supabase", battleId, result: access.battle.result, idempotent: true });
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
    reason: "vote_counts",
    mode: access.battle.mode ?? "freestyle",
    queue_type: access.battle.queue_type ?? null,
    battle_type: access.battle.battle_type ?? null,
    is_bot_battle: Boolean(access.battle.is_bot_battle),
    fallback_reason: access.battle.fallback_reason ?? "none",
    wait_time_ms: access.battle.wait_time_ms ?? 0,
    mmr_neutral: Boolean(access.battle.mmr_neutral),
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
    .select("id,user_id,slot")
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

  const idempotencyKey = `finalize:${battleId}`;
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

  const ratingsIdempotencyKey = `elo:${battleId}`;
  const { data: eloData, error: eloError } = await supabase.rpc("apply_battle_elo_ratings", {
    p_idempotency_key: ratingsIdempotencyKey,
    p_battle_id: battleId,
    p_winner_slot: winnerSlot ?? 0,
  });

  if (eloError) {
    return NextResponse.json(
      { ok: true, mode: "supabase", battleId, result, rpc: rpcData, ratings_error: eloError.message, idempotent: false },
      { status: 200 },
    );
  }

  const enrichedResult = {
    ...result,
    rating_deltas: eloData?.elo ?? null,
  };

  try {
    const winnerParticipant = winnerSlot
      ? (participants ?? []).find((p: { user_id?: string; slot?: number }) => p.slot === winnerSlot)
      : null;
    await supabase.from("activity_feed").insert({
      actor_id: winnerParticipant?.user_id ?? user.id,
      type: "battle_complete",
      entity_id: battleId,
      entity_type: "battle",
      metadata: {
        battle_id: battleId,
        winner_slot: winnerSlot,
        votes_a: countA,
        votes_b: countB,
        mode: access.battle.mode ?? "freestyle",
        battle_type: access.battle.battle_type ?? null,
        is_bot_battle: Boolean(access.battle.is_bot_battle),
        mmr_neutral: Boolean(access.battle.mmr_neutral),
      },
    });
  } catch {
    // Non-critical - swallow silently
  }

  const startedAtMs = access.battle.started_at ? new Date(access.battle.started_at).getTime() : NaN;
  const durationMs = Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : 0;
  await getTelemetrySystem()
    .emitMatchEnd(battleId, {
      winner: winnerSlot,
      duration_ms: durationMs,
      final_scores: { 1: countA, 2: countB },
      is_close_match: Math.abs(countA - countB) <= 2,
      is_comeback: false,
      rage_quit_detected: false,
    })
    .catch(() => null);

  try {
    const adminClient = createSupabaseServiceRoleClient();
    await Promise.all(
      (participants ?? [])
        .map((participant: { user_id?: string | null }) => participant.user_id)
        .filter((participantId: string | null | undefined): participantId is string => Boolean(participantId))
        .map((participantId: string) =>
          markReferralActivated(adminClient, participantId, "first_battle_completed").catch(() => null),
        ),
    );
  } catch {
    // Non-critical
  }

  return NextResponse.json({ ok: true, mode: "supabase", battleId, result: enrichedResult, rpc: rpcData, elo: eloData, idempotent: false });
}
