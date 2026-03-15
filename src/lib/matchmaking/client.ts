type QueueType = "freestyle" | "ranked" | "tournament";
type BattleFormat = "30s" | "60s" | "90s" | "120s";

export interface MatchmakingResult {
  ok: true;
  mode: QueueType;
  status: "queued" | "matched" | "none";
  matched: boolean;
  battleId: string | null;
  isBotBattle: boolean;
  fallbackReason: "none" | "timed_bot_fallback";
  waitTimeMs: number;
  queueType: QueueType;
}

export class ClientMatchmaking {
  async enqueue(
    _userId: string,
    queueType: QueueType,
    options: {
      battleFormat?: BattleFormat;
      preferredGenres?: string[];
      leave?: boolean;
      idempotencyKey?: string;
    } = {},
  ): Promise<MatchmakingResult> {
    const idempotencyKey = options.idempotencyKey ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : undefined);
    const response = await fetch("/api/matchmaking/enqueue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      },
      body: JSON.stringify({
        queueType,
        battleFormat: options.battleFormat ?? "60s",
        preferredGenres: options.preferredGenres ?? [],
        action: options.leave ? "leave" : undefined,
        idempotencyKey,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.details ?? payload?.error ?? "Failed to enqueue");
    }

    return payload as MatchmakingResult;
  }

  async dequeue(_userId: string, queueType: QueueType = "freestyle"): Promise<void> {
    await this.enqueue(_userId, queueType, { leave: true });
  }

  async getStatus(_userId: string, queueType: QueueType = "freestyle"): Promise<MatchmakingResult> {
    const query = new URLSearchParams({ mode: queueType });
    const response = await fetch(`/api/matchmaking/status?${query.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.details ?? payload?.error ?? "Failed to fetch status");
    }

    return payload as MatchmakingResult;
  }

  async getBattle(battleId: string) {
    const res = await fetch(`/api/battles/${encodeURIComponent(battleId)}`);
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.details ?? body?.error ?? "Failed to load battle");
    }
    return body?.battle ?? null;
  }
}

let matchmakingInstance: ClientMatchmaking | null = null;

export function getMatchmaking() {
  if (!matchmakingInstance) {
    matchmakingInstance = new ClientMatchmaking();
  }
  return matchmakingInstance;
}

export const enqueue = async (
  userId: string,
  queueType: QueueType,
  options?: { battleFormat?: BattleFormat; preferredGenres?: string[]; leave?: boolean; idempotencyKey?: string },
) => {
  const matchmaking = getMatchmaking();
  return matchmaking.enqueue(userId, queueType, options);
};

export const getStatus = async (userId: string, queueType: QueueType = "freestyle") => {
  const matchmaking = getMatchmaking();
  return matchmaking.getStatus(userId, queueType);
};
