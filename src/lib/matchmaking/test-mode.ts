import type { MatchmakingResponse, QueueMode } from "@/lib/matchmaking/server";

type QueueState = {
  userId: string;
  queueType: QueueMode;
  status: "queued" | "matched";
  queuedAt: number;
  battleId: string | null;
  isBotBattle: boolean;
};

const globalState = globalThis as typeof globalThis & {
  __arenaTestQueue?: Map<string, QueueState>;
};

const queueStore = globalState.__arenaTestQueue ?? new Map<string, QueueState>();
globalState.__arenaTestQueue = queueStore;

function timeoutFor(mode: QueueMode) {
  return mode === "ranked" ? 45_000 : 20_000;
}

function waitMs(queuedAt: number) {
  return Math.max(0, Date.now() - queuedAt);
}

export function runTestModeMatchmaking(params: {
  userId: string;
  queueType: QueueMode;
  leave?: boolean;
}): MatchmakingResponse {
  const { userId, queueType, leave } = params;
  const key = `${queueType}:${userId}`;
  const existing = queueStore.get(key);

  const testPairMatch = userId.match(/^(.*)-([ab])$/);
  if (!leave && testPairMatch) {
    const base = testPairMatch[1];
    const counterpart = testPairMatch[2] === "a" ? `${base}-b` : `${base}-a`;
    const ids = [userId, counterpart].sort();
    const battleId = `test_pair_${queueType}_${ids[0]}_${ids[1]}`;
    queueStore.set(key, {
      userId,
      queueType,
      status: "matched",
      queuedAt: Date.now(),
      battleId,
      isBotBattle: false,
    });
    return {
      ok: true,
      mode: queueType,
      status: "matched",
      matched: true,
      battleId,
      isBotBattle: false,
      fallbackReason: "none",
      waitTimeMs: 0,
      queueType,
    };
  }

  if (leave) {
    queueStore.delete(key);
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
    };
  }

  if (existing?.status === "matched" && existing.battleId) {
    return {
      ok: true,
      mode: queueType,
      status: "matched",
      matched: true,
      battleId: existing.battleId,
      isBotBattle: existing.isBotBattle,
      fallbackReason: existing.isBotBattle ? "timed_bot_fallback" : "none",
      waitTimeMs: waitMs(existing.queuedAt),
      queueType,
    };
  }

  if (!existing) {
    queueStore.set(key, {
      userId,
      queueType,
      status: "queued",
      queuedAt: Date.now(),
      battleId: null,
      isBotBattle: false,
    });
  }

  const opponent = Array.from(queueStore.values()).find(
    (entry) => entry.queueType === queueType && entry.userId !== userId && entry.status === "queued",
  );

  if (opponent) {
    const battleId = `test_${queueType}_${Date.now()}`;
    queueStore.set(key, {
      userId,
      queueType,
      status: "matched",
      queuedAt: existing?.queuedAt ?? Date.now(),
      battleId,
      isBotBattle: false,
    });
    queueStore.set(`${queueType}:${opponent.userId}`, {
      ...opponent,
      status: "matched",
      battleId,
      isBotBattle: false,
    });

    return {
      ok: true,
      mode: queueType,
      status: "matched",
      matched: true,
      battleId,
      isBotBattle: false,
      fallbackReason: "none",
      waitTimeMs: waitMs(existing?.queuedAt ?? Date.now()),
      queueType,
    };
  }

  const queued = queueStore.get(key);
  const elapsed = waitMs(queued?.queuedAt ?? Date.now());
  if (elapsed >= timeoutFor(queueType)) {
    const battleId = `test_bot_${queueType}_${Date.now()}`;
    queueStore.set(key, {
      userId,
      queueType,
      status: "matched",
      queuedAt: queued?.queuedAt ?? Date.now(),
      battleId,
      isBotBattle: true,
    });
    return {
      ok: true,
      mode: queueType,
      status: "matched",
      matched: true,
      battleId,
      isBotBattle: true,
      fallbackReason: "timed_bot_fallback",
      waitTimeMs: elapsed,
      queueType,
    };
  }

  return {
    ok: true,
    mode: queueType,
    status: "queued",
    matched: false,
    battleId: null,
    isBotBattle: false,
    fallbackReason: "none",
    waitTimeMs: elapsed,
    queueType,
  };
}
