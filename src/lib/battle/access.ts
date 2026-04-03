import type { SupabaseClient } from "@supabase/supabase-js";

export type BattleLifecycleStatus = "draft" | "queued" | "matched" | "live" | "complete" | "canceled";
export type SessionRole = "user" | "mod" | "admin" | null;

export type BattleAccessRow = {
  id: string;
  created_by: string | null;
  status: BattleLifecycleStatus | string;
  mode?: string | null;
  queue_type?: string | null;
  battle_type?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  voting_opened_at?: string | null;
  voting_closes_at?: string | null;
  result?: unknown | null;
  is_bot_battle?: boolean | null;
  fallback_reason?: string | null;
  wait_time_ms?: number | null;
  mmr_neutral?: boolean | null;
};

export type BattleAccess = {
  battle: BattleAccessRow;
  isParticipant: boolean;
  participantSlot: number | null;
  canModerate: boolean;
  canManage: boolean;
};

export function isModOrAdmin(role: SessionRole) {
  return role === "mod" || role === "admin";
}

export function isTerminalBattleStatus(status: string | null | undefined) {
  return status === "complete" || status === "canceled";
}

export function isSpectatableBattleStatus(status: string | null | undefined) {
  return status === "matched" || status === "live" || status === "complete";
}

export function canViewBattle(params: {
  battle: Pick<BattleAccessRow, "status" | "created_by">;
  userId: string;
  isParticipant: boolean;
  canModerate: boolean;
}) {
  const { battle, userId, isParticipant, canModerate } = params;
  return (
    isParticipant ||
    battle.created_by === userId ||
    canModerate ||
    isSpectatableBattleStatus(battle.status)
  );
}

export function canTransitionBattleStatus(
  currentStatus: string | null | undefined,
  nextStatus: BattleLifecycleStatus,
) {
  if (!currentStatus) {
    return nextStatus === "draft" || nextStatus === "queued" || nextStatus === "matched";
  }

  if (currentStatus === nextStatus) {
    return true;
  }

  if (currentStatus === "draft") {
    return nextStatus === "queued" || nextStatus === "matched" || nextStatus === "live" || nextStatus === "canceled";
  }

  if (currentStatus === "queued" || currentStatus === "matched") {
    return nextStatus === "live" || nextStatus === "canceled";
  }

  if (currentStatus === "live") {
    return nextStatus === "complete" || nextStatus === "canceled";
  }

  return false;
}

export async function loadBattleAccess(params: {
  supabase: SupabaseClient;
  battleId: string;
  userId: string;
  role: SessionRole;
  select?: string;
}) {
  const {
    supabase,
    battleId,
    userId,
    role,
    select = "id,created_by,status,mode,queue_type,battle_type,started_at,ended_at,voting_opened_at,voting_closes_at,result,is_bot_battle,fallback_reason,wait_time_ms,mmr_neutral",
  } = params;

  const [{ data: battle, error: battleError }, { data: participant, error: participantError }] = await Promise.all([
    supabase.from("battles").select(select).eq("id", battleId).maybeSingle(),
    supabase
      .from("battle_participants")
      .select("slot")
      .eq("battle_id", battleId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (battleError) {
    throw new Error(`battle_fetch_failed:${battleError.message}`);
  }

  if (participantError) {
    throw new Error(`participant_lookup_failed:${participantError.message}`);
  }

  if (!battle) {
    return null;
  }

  const canModerate = isModOrAdmin(role);
  const isParticipant = Boolean(participant?.slot);

  return {
    battle: battle as unknown as BattleAccessRow,
    isParticipant,
    participantSlot: participant?.slot ?? null,
    canModerate,
    canManage: isParticipant || (battle as { created_by?: string | null }).created_by === userId || canModerate,
  } satisfies BattleAccess;
}
