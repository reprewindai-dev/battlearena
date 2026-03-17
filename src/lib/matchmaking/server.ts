import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { BotOpponent, selectBotOpponent } from "@/lib/ai/bot-opponent";

type AdminClient = SupabaseClient;

export type QueueMode = "freestyle" | "ranked" | "tournament";

export type MatchmakingResponse = {
  ok: true;
  mode: QueueMode;
  status: "queued" | "matched" | "none";
  matched: boolean;
  battleId: string | null;
  isBotBattle: boolean;
  fallbackReason: "none" | "timed_bot_fallback";
  waitTimeMs: number;
  queueType: QueueMode;
};

export function normalizeQueueMode(value: unknown): QueueMode {
  if (value === "ranked") return "ranked";
  if (value === "tournament") return "tournament";
  return "freestyle";
}

export function getQueueTimeoutMs(mode: QueueMode): number {
  if (mode === "ranked") return 45_000;
  return 20_000;
}

export async function ensurePublicUser(adminClient: AdminClient, user: { id: string; email?: string | null }, usernameHint?: string) {
  const username =
    usernameHint ??
    user.email?.split("@")[0] ??
    `user_${user.id.slice(0, 8)}`;

  const { error } = await adminClient
    .from("users")
    .upsert(
      {
        id: user.id,
        email: user.email ?? `${username}@battlearena.com`,
        username,
      },
      { onConflict: "id" },
    );

  if (error) {
    throw new Error(`user_upsert_failed:${error.message}`);
  }
}

function elapsedMs(fromIso: string | null | undefined) {
  if (!fromIso) return 0;
  const ts = new Date(fromIso).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Date.now() - ts);
}

async function insertBattleParticipants(adminClient: AdminClient, battleId: string, userA: string, userB: string | null) {
  const rows: Array<{ battle_id: string; user_id: string; slot: number }> = [{
    battle_id: battleId,
    user_id: userA,
    slot: 1,
  }];

  if (userB) {
    rows.push({
      battle_id: battleId,
      user_id: userB,
      slot: 2,
    });
  }

  const { error } = await adminClient.from("battle_participants").insert(rows);
  if (error) {
    throw new Error(`participant_insert_failed:${error.message}`);
  }
}

async function createHumanBattle(adminClient: AdminClient, userA: string, userB: string, queueType: QueueMode, battleFormat: string) {
  const roomId = `battle_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const { data: battle, error } = await adminClient
    .from("battles")
    .insert({
      created_by: userA,
      participant_1_id: userA,
      participant_2_id: userB,
      queue_type: queueType,
      battle_format: battleFormat,
      status: "matched",
      room_id: roomId,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      is_bot_battle: false,
      fallback_reason: "none",
      wait_time_ms: 0,
    })
    .select("id")
    .single();

  if (error || !battle?.id) {
    throw new Error(`battle_create_failed:${error?.message ?? "unknown"}`);
  }

  await insertBattleParticipants(adminClient, battle.id, userA, userB);

  return battle.id as string;
}

async function createBotBattle(adminClient: AdminClient, userId: string, queueType: QueueMode, battleFormat: string, waitedMs: number) {
  const { data: profile } = await adminClient
    .from("users")
    .select("skill_level")
    .eq("id", userId)
    .single();

  const skillLevel = profile?.skill_level ?? 50;
  const botPersonality = selectBotOpponent(skillLevel);
  const botOpponent = new BotOpponent(botPersonality.id, null);

  const roomId = `battle_${Date.now()}_${randomUUID().slice(0, 8)}`;

  const battleType = queueType === "ranked" ? "ranked_bot" : "casual_bot";
  const { data: battle, error } = await adminClient
    .from("battles")
    .insert({
      created_by: userId,
      participant_1_id: userId,
      participant_2_id: null,
      queue_type: queueType,
      battle_format: battleFormat,
      status: "matched",
      room_id: roomId,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      is_bot_battle: true,
      bot_personality_id: botOpponent.getPersonality().id,
      bot_difficulty: botOpponent.getPersonality().difficulty,
      fallback_reason: "timed_bot_fallback",
      wait_time_ms: waitedMs,
      battle_type: battleType,
      mmr_neutral: queueType === "ranked",
    })
    .select("id")
    .single();

  if (error || !battle?.id) {
    throw new Error(`bot_battle_create_failed:${error?.message ?? "unknown"}`);
  }

  await insertBattleParticipants(adminClient, battle.id, userId, null);

  return {
    battleId: battle.id as string,
    botPersonality,
  };
}

export async function createImmediateBotMatch(params: {
  adminClient: AdminClient;
  userId: string;
  queueType: QueueMode;
  battleFormat: string;
}) {
  const { adminClient, userId, queueType, battleFormat } = params;

  const bot = await createBotBattle(adminClient, userId, queueType, battleFormat, 0);

  await adminClient
    .from("matchmaking_queue")
    .update({ status: "matched", battle_id: bot.battleId })
    .eq("user_id", userId)
    .eq("queue_type", queueType)
    .in("status", ["active", "queued"]);

  return {
    ok: true,
    mode: queueType,
    status: "matched",
    matched: true,
    battleId: bot.battleId,
    isBotBattle: true,
    fallbackReason: "timed_bot_fallback",
    waitTimeMs: 0,
    queueType,
  } satisfies MatchmakingResponse;
}

export async function runMatchmakingStep(params: {
  adminClient: AdminClient;
  userId: string;
  queueType: QueueMode;
  battleFormat: string;
  preferredGenres: string[];
  allowLeave?: boolean;
  leave?: boolean;
  createIfMissing?: boolean;
  idempotencyKey?: string;
}) {
  const { adminClient, userId, queueType, battleFormat, preferredGenres, leave, createIfMissing = true, idempotencyKey } = params;

  if (leave) {
    await adminClient.from("matchmaking_queue").delete().eq("user_id", userId).eq("queue_type", queueType);
    return {
      ok: true,
      mode: queueType,
      status: "none",
      matched: false,
      battleId: null,
      isBotBattle: false,
      fallbackReason: "none",
      waitTimeMs: 0,
      queueType,
    } satisfies MatchmakingResponse;
  }

  const timeoutMs = getQueueTimeoutMs(queueType);

  const { data: existing } = await adminClient
    .from("matchmaking_queue")
    .select("id,user_id,queue_type,battle_format,status,created_at,battle_id")
    .eq("user_id", userId)
    .eq("queue_type", queueType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.status === "matched" && existing.battle_id) {
    const { data: battleMeta } = await adminClient
      .from("battles")
      .select("is_bot_battle,fallback_reason,wait_time_ms")
      .eq("id", existing.battle_id)
      .maybeSingle();

    return {
      ok: true,
      mode: queueType,
      status: "matched",
      matched: true,
      battleId: existing.battle_id,
      isBotBattle: Boolean(battleMeta?.is_bot_battle),
      fallbackReason: battleMeta?.fallback_reason === "timed_bot_fallback" ? "timed_bot_fallback" : "none",
      waitTimeMs: typeof battleMeta?.wait_time_ms === "number" ? battleMeta.wait_time_ms : elapsedMs(existing.created_at),
      queueType,
    } satisfies MatchmakingResponse;
  }

  if (!existing || existing.status !== "active") {
    if (!createIfMissing) {
      return {
        ok: true,
        mode: queueType,
        status: "none",
        matched: false,
        battleId: null,
        isBotBattle: false,
        fallbackReason: "none",
        waitTimeMs: 0,
        queueType,
      } satisfies MatchmakingResponse;
    }

    await adminClient.from("matchmaking_queue").delete().eq("user_id", userId).eq("queue_type", queueType);

    const { error: queueInsertError } = await adminClient
      .from("matchmaking_queue")
      .insert({
        user_id: userId,
        queue_type: queueType,
        battle_format: battleFormat,
        preferred_genres: preferredGenres,
        idempotency_key: idempotencyKey ?? null,
        status: "active",
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (queueInsertError) {
      throw new Error(`enqueue_failed:${queueInsertError.message}`);
    }
  }

  const { data: selfQueue } = await adminClient
    .from("matchmaking_queue")
    .select("id,created_at")
    .eq("user_id", userId)
    .eq("queue_type", queueType)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const waitedMs = elapsedMs(selfQueue?.created_at);

  const { data: opponent } = await adminClient
    .from("matchmaking_queue")
    .select("id,user_id,created_at")
    .eq("queue_type", queueType)
    .eq("battle_format", battleFormat)
    .eq("status", "active")
    .neq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (opponent?.user_id) {
    const battleId = await createHumanBattle(adminClient, userId, opponent.user_id, queueType, battleFormat);

    await adminClient
      .from("matchmaking_queue")
      .update({ status: "matched", battle_id: battleId })
      .in("id", [selfQueue?.id, opponent.id].filter(Boolean));

    return {
      ok: true,
      mode: queueType,
      status: "matched",
      matched: true,
      battleId,
      isBotBattle: false,
      fallbackReason: "none",
      waitTimeMs: waitedMs,
      queueType,
    } satisfies MatchmakingResponse;
  }

  if (waitedMs >= timeoutMs) {
    const bot = await createBotBattle(adminClient, userId, queueType, battleFormat, waitedMs);

    await adminClient
      .from("matchmaking_queue")
      .update({ status: "matched", battle_id: bot.battleId })
      .eq("user_id", userId)
      .eq("queue_type", queueType)
      .eq("status", "active");

    return {
      ok: true,
      mode: queueType,
      status: "matched",
      matched: true,
      battleId: bot.battleId,
      isBotBattle: true,
      fallbackReason: "timed_bot_fallback",
      waitTimeMs: waitedMs,
      queueType,
    } satisfies MatchmakingResponse;
  }

  return {
    ok: true,
    mode: queueType,
    status: "queued",
    matched: false,
    battleId: null,
    isBotBattle: false,
    fallbackReason: "none",
    waitTimeMs: waitedMs,
    queueType,
  } satisfies MatchmakingResponse;
}

export async function readIdempotentMatchmakingResult(params: {
  adminClient: AdminClient;
  userId: string;
  key: string;
  scope: string;
}): Promise<{ statusCode: number; response: MatchmakingResponse } | null> {
  const { adminClient, userId, key, scope } = params;
  const storageKey = `${userId}:${scope}:${key}`;

  const { data } = await adminClient
    .from("idempotency_keys")
    .select("status_code,response")
    .eq("key", storageKey)
    .eq("scope", scope)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.response) return null;

  return {
    statusCode: typeof data.status_code === "number" ? data.status_code : 200,
    response: data.response as MatchmakingResponse,
  };
}

export async function writeIdempotentMatchmakingResult(params: {
  adminClient: AdminClient;
  userId: string;
  key: string;
  scope: string;
  statusCode: number;
  response: MatchmakingResponse;
}) {
  const { adminClient, userId, key, scope, statusCode, response } = params;
  const storageKey = `${userId}:${scope}:${key}`;

  await adminClient.from("idempotency_keys").upsert(
    {
      key: storageKey,
      scope,
      user_id: userId,
      status_code: statusCode,
      response,
      created_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}
