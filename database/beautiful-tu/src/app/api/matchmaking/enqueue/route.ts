import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { createRequestLogContext, logStructured, withRequestId } from "@/lib/logging/structured";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import {
  ensurePublicUser,
  normalizeQueueMode,
  readIdempotentMatchmakingResult,
  runMatchmakingStep,
  writeIdempotentMatchmakingResult,
} from "@/lib/matchmaking/server";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";

function normalizeBattleFormat(value: unknown) {
  if (typeof value !== "string") return "60s";
  const trimmed = value.trim();
  if (!trimmed) return "60s";
  return trimmed.slice(0, 20);
}

export async function POST(request: Request) {
  const logContext = createRequestLogContext(request, "/api/matchmaking/enqueue");
  try {
    const user = await getSessionUser();
    if (!user) {
      logStructured("warn", "matchmaking_enqueue_unauthenticated", logContext);
      return withRequestId(
        NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
        logContext.request_id,
      );
    }
    logContext.user_id = user.id;

    const body: Record<string, unknown> = await request
      .json()
      .catch(() => ({} as Record<string, unknown>));
    const queueType = normalizeQueueMode(body.queueType);
    const battleFormat = normalizeBattleFormat(body.battleFormat);
    const preferredGenres = Array.isArray(body.preferredGenres)
      ? body.preferredGenres.filter((v): v is string => typeof v === "string")
      : [];
    const leave = body.action === "leave" || body.leave === true;
    const idempotencyKeyFromBody =
      typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const idempotencyKeyFromHeader = request.headers.get("x-idempotency-key")?.trim() ?? "";
    const idempotencyKey = idempotencyKeyFromHeader || idempotencyKeyFromBody;
    const adminClient = createSupabaseServiceRoleClient();
    const scope = `matchmaking:enqueue:${queueType}`;

    const username =
      (typeof body.username === "string" && body.username) ||
      user.email?.split("@")[0];

    await ensurePublicUser(adminClient, user, username);

    if (idempotencyKey) {
      const existing = await readIdempotentMatchmakingResult({
        adminClient,
        userId: user.id,
        key: idempotencyKey,
        scope,
      });
      if (existing) {
        logStructured("info", "matchmaking_enqueue_idempotent_hit", logContext, {
          queue_type: queueType,
          idempotency_key: idempotencyKey,
        });
        return withRequestId(
          NextResponse.json(existing.response, { status: existing.statusCode }),
          logContext.request_id,
        );
      }
    }

    const result = await runMatchmakingStep({
      adminClient,
      userId: user.id,
      queueType,
      battleFormat,
      preferredGenres,
      leave,
      idempotencyKey: idempotencyKey || undefined,
    });

    const telemetry = getTelemetrySystem();
    await telemetry
      .emitQueueEnter(user.id, {
        mode: queueType,
        region: "global",
        player_mmr: null,
      })
      .catch(() => null);

    if (result.matched && result.battleId) {
      await telemetry
        .emitQueueMatchFound(user.id, {
          match_id: result.battleId,
          opponent_type: result.isBotBattle ? "bot" : "human",
          opponent_mmr: null,
          queue_duration_ms: result.waitTimeMs,
          governance_tier: result.isBotBattle ? "fallback" : "standard",
        })
        .catch(() => null);
    }

    if (idempotencyKey) {
      await writeIdempotentMatchmakingResult({
        adminClient,
        userId: user.id,
        key: idempotencyKey,
        scope,
        statusCode: 200,
        response: result,
      });
    }

    logStructured("info", leave ? "matchmaking_queue_left" : "matchmaking_queue_processed", logContext, {
      queue_type: queueType,
      battle_format: battleFormat,
      matched: result.matched,
      battle_id: result.battleId ?? null,
      is_bot_battle: result.isBotBattle ?? false,
      wait_time_ms: result.waitTimeMs ?? null,
      fallback_reason: result.fallbackReason ?? null,
      idempotency_key: idempotencyKey || null,
    });

    return withRequestId(
      NextResponse.json(result),
      logContext.request_id,
    );
  } catch (error: unknown) {
    logStructured("error", "matchmaking_enqueue_failed", logContext, {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return withRequestId(
      NextResponse.json(
      {
        error: "matchmaking_enqueue_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
      ),
      logContext.request_id,
    );
  }
}
