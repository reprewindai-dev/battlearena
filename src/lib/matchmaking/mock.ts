type QueueMode = "freestyle" | "ranked" | string;

type QueueRow = {
  userId: string;
  mode: QueueMode;
  status: "queued" | "matched";
  battleId: string | null;
  createdAtMs: number;
};

type Store = {
  rows: Map<string, QueueRow>;
  battleCounter: number;
};

declare global {
  var __arenaMockMatchmaking: Store | undefined;
}

function getStore(): Store {
  if (!globalThis.__arenaMockMatchmaking) {
    globalThis.__arenaMockMatchmaking = {
      rows: new Map<string, QueueRow>(),
      battleCounter: 0,
    };
  }
  return globalThis.__arenaMockMatchmaking;
}

function key(userId: string, mode: QueueMode) {
  return `${userId}:${mode}`;
}

export function mockEnqueue(userId: string, mode: QueueMode) {
  const store = getStore();
  const now = Date.now();

  const existing = store.rows.get(key(userId, mode));
  if (existing && (existing.status === "queued" || existing.status === "matched")) {
    return existing;
  }

  const row: QueueRow = {
    userId,
    mode,
    status: "queued",
    battleId: null,
    createdAtMs: now,
  };
  store.rows.set(key(userId, mode), row);

  // Matchmaking behavior in mock mode:
  // - freestyle: match first-come-first-served
  // - ranked: also match first-come-first-served (rating logic is DB-only), but deterministically pair two users
  const opponent = Array.from(store.rows.values())
    .filter((r) => r.mode === mode && r.status === "queued" && r.userId !== userId)
    .sort((a, b) => a.createdAtMs - b.createdAtMs)[0];

  if (!opponent) return row;

  store.battleCounter += 1;
  const battleId = `mock_${mode}_${store.battleCounter}`;

  row.status = "matched";
  row.battleId = battleId;
  opponent.status = "matched";
  opponent.battleId = battleId;

  store.rows.set(key(userId, mode), row);
  store.rows.set(key(opponent.userId, mode), opponent);

  return row;
}

export function mockStatus(userId: string, mode: QueueMode) {
  const store = getStore();
  return store.rows.get(key(userId, mode)) ?? null;
}
