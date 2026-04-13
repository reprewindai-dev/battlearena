import {
  ClientMatchmaking,
  enqueue as enqueueApi,
  getStatus as getStatusApi,
} from "@/lib/matchmaking/client";

export { ClientMatchmaking as ProductionMatchmaking };

export function getMatchmaking() {
  return new ClientMatchmaking();
}

export async function enqueue(_userId: string, mode: "freestyle" | "ranked" | "tournament") {
  return enqueueApi(mode);
}

export async function getStatus(_userId: string, mode: "freestyle" | "ranked" | "tournament") {
  return getStatusApi(mode);
}

export async function leaveQueue(_userId: string, mode: "freestyle" | "ranked" | "tournament") {
  const matchmaking = getMatchmaking();
  await matchmaking.dequeue(mode);
}
