import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const FinalizeSchema = z.object({
  winnerSlot: z.number().int().min(1).max(2).optional(),
  scores: z
    .object({
      userScore: z.number().int().min(0).optional(),
      botScore: z.number().int().min(0).optional(),
      slot1: z.number().int().min(0).optional(),
      slot2: z.number().int().min(0).optional(),
    })
    .optional(),
  winner: z.enum(["user", "bot", "draw"]).optional(),
});

function normalizeWinnerSlot(params: {
  winnerSlot: number | undefined;
  winner: "user" | "bot" | "draw" | undefined;
  requesterSlot: number | null;
}) {
  if (typeof params.winnerSlot === "number") {
    return params.winnerSlot;
  }

  if (params.winner === "draw") {
    return null;
  }

  if (params.winner === "user") {
    return params.requesterSlot;
  }

  if (params.winner === "bot") {
    if (params.requesterSlot === 1) return 2;
    if (params.requesterSlot === 2) return 1;
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ battleId: string }> },
) {
  try {
    const { battleId } = await params;

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const adminClient = createSupabaseServiceRoleClient();

    const [{ data: battle, error: battleError }, { data: participants, error: participantError }] = await Promise.all([
      adminClient
        .from("battles")
        .select(
          "id,status,mode,created_by,created_at,started_at,ended_at,current_round,voting_opened_at,voting_closes_at,result,is_bot_battle,bot_personality_id,bot_difficulty,fallback_reason,wait_time_ms,mmr_neutral",
        )
        .eq("id", battleId)
        .maybeSingle(),
      adminClient
        .from("battle_participants")
        .select("user_id,slot,score")
        .eq("battle_id", battleId)
        .order("slot", { ascending: true }),
    ]);

    if (battleError) {
      return NextResponse.json({ error: "battle_lookup_failed", details: battleError.message }, { status: 500 });
    }

    if (participantError) {
      return NextResponse.json(
        { error: "battle_participant_lookup_failed", details: participantError.message },
        { status: 500 },
      );
    }

    if (!battle) {
      return NextResponse.json({ error: "battle_not_found" }, { status: 404 });
    }

    const isParticipant = (participants ?? []).some((p) => p.user_id === user.id);
    if (!isParticipant && battle.created_by !== user.id) {
      return NextResponse.json({ error: "not_participant" }, { status: 403 });
    }

    return NextResponse.json({
      battle: {
        ...battle,
        participants: participants ?? [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "unknown_error",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ battleId: string }> },
) {
  try {
    const { battleId } = await params;

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = FinalizeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
    }

    const adminClient = createSupabaseServiceRoleClient();

    const { data: participants, error: participantError } = await adminClient
      .from("battle_participants")
      .select("user_id,slot")
      .eq("battle_id", battleId)
      .order("slot", { ascending: true });

    if (participantError) {
      return NextResponse.json(
        { error: "battle_participant_lookup_failed", details: participantError.message },
        { status: 500 },
      );
    }

    const requesterParticipant = (participants ?? []).find((p) => p.user_id === user.id) ?? null;
    if (!requesterParticipant) {
      return NextResponse.json({ error: "not_participant" }, { status: 403 });
    }

    const winnerSlot = normalizeWinnerSlot({
      winnerSlot: parsed.data.winnerSlot,
      winner: parsed.data.winner,
      requesterSlot: requesterParticipant.slot,
    });

    const score1 =
      parsed.data.scores?.slot1 ??
      parsed.data.scores?.userScore ??
      null;
    const score2 =
      parsed.data.scores?.slot2 ??
      parsed.data.scores?.botScore ??
      null;

    const payload = {
      winner_slot: winnerSlot,
      final_scores:
        score1 !== null || score2 !== null
          ? { 1: score1 ?? 0, 2: score2 ?? 0 }
          : null,
      finalized_by: user.id,
      finalized_at: new Date().toISOString(),
      source: "api/battles/[battleId]",
    };

    const idempotencyKey = request.headers.get("x-idempotency-key") ?? `battle_finalize:${battleId}:${randomUUID()}`;

    const { error: rpcError } = await adminClient.rpc("record_battle_result", {
      p_idempotency_key: idempotencyKey,
      p_battle_id: battleId,
      p_result: payload,
    });

    if (rpcError) {
      return NextResponse.json({ error: "battle_finalize_failed", details: rpcError.message }, { status: 500 });
    }

    const { data: refreshedBattle, error: refreshError } = await adminClient
      .from("battles")
      .select("id,status,result,ended_at")
      .eq("id", battleId)
      .maybeSingle();

    if (refreshError) {
      return NextResponse.json({ error: "battle_refresh_failed", details: refreshError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      battle: refreshedBattle,
      message:
        winnerSlot === null
          ? "Battle finalized: draw"
          : `Battle finalized: winner slot ${winnerSlot}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "unknown_error",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
