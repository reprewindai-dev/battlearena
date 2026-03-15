import {
  ClientMatchmaking,
  enqueue as enqueueApi,
  getStatus as getStatusApi,
} from "@/lib/matchmaking/client";

export { ClientMatchmaking as ProductionMatchmaking };

export function getMatchmaking() {
  return new ClientMatchmaking();
}

export async function enqueue(userId: string, mode: "freestyle" | "ranked" | "tournament") {
  return enqueueApi(userId, mode);
}

export async function getStatus(userId: string, mode: "freestyle" | "ranked" | "tournament") {
  return getStatusApi(userId, mode);
}

export async function leaveQueue(userId: string, mode: "freestyle" | "ranked" | "tournament") {
  const matchmaking = getMatchmaking();
  await matchmaking.dequeue(userId, mode);
}
