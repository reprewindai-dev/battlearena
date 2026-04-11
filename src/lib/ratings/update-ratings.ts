/**
 * Post-battle rating update service using Glicko-2.
 * Called after each battle finalizes to update ratings and award economy currency.
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { resolveMatch, getTierForRating, DEFAULT_PLAYER } from "@/lib/ratings/glicko2";
import type { Glicko2Player } from "@/lib/ratings/glicko2";
import { awardBattleCrowns, awardParticipationTokens } from "@/lib/economy/wallet";

interface BattleRatingUpdateParams {
  battleId: string;
  winnerUserId: string | null;
  loserUserId: string | null;
  isBotBattle?: boolean;
}

async function fetchPlayerRating(userId: string): Promise<Glicko2Player> {
  const client = createSupabaseServiceRoleClient();
  const { data } = await client
    .from("user_ratings")
    .select("rating,rating_deviation,volatility")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return { ...DEFAULT_PLAYER };

  const d = data as { rating?: number; rating_deviation?: number; volatility?: number };
  return {
    rating: d.rating ?? DEFAULT_PLAYER.rating,
    rd: d.rating_deviation ?? DEFAULT_PLAYER.rd,
    volatility: d.volatility ?? DEFAULT_PLAYER.volatility,
  };
}

async function savePlayerRating(
  userId: string,
  updated: Glicko2Player,
  isWin: boolean,
  battleId: string
): Promise<void> {
  const client = createSupabaseServiceRoleClient();
  const newTier = getTierForRating(updated.rating);

  await client
    .from("user_ratings")
    .upsert(
      {
        user_id: userId,
        rating: updated.rating,
        rating_deviation: updated.rd,
        volatility: updated.volatility,
        tier: newTier,
        wins: isWin ? 1 : 0,
        losses: isWin ? 0 : 1,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: false,
      }
    )
    .select("user_id");

  // Increment wins/losses separately via RPC-safe increment pattern
  const incrementField = isWin ? "wins" : "losses";
  await client.rpc("increment_user_rating_stat" as string, {
    p_user_id: userId,
    p_field: incrementField,
  }).catch(() => null); // Non-critical if RPC doesn't exist yet

  // Save to rating history
  await client.from("rating_history").insert({
    user_id: userId,
    rating: updated.rating,
    rating_deviation: updated.rd,
    volatility: updated.volatility,
    tier: newTier,
    reference_battle_id: battleId,
  }).catch(() => null);
}

/**
 * Apply Glicko-2 rating updates and economy awards after a battle.
 * This is non-critical — failures are swallowed to not block battle finalization.
 */
export async function applyPostBattleUpdates(params: BattleRatingUpdateParams): Promise<void> {
  const { battleId, winnerUserId, loserUserId, isBotBattle = false } = params;

  try {
    // Only update ratings for PvP battles with two real players
    if (!isBotBattle && winnerUserId && loserUserId) {
      const [winnerRating, loserRating] = await Promise.all([
        fetchPlayerRating(winnerUserId),
        fetchPlayerRating(loserUserId),
      ]);

      const { winner: updatedWinner, loser: updatedLoser } = resolveMatch(winnerRating, loserRating);

      await Promise.all([
        savePlayerRating(winnerUserId, updatedWinner, true, battleId),
        savePlayerRating(loserUserId, updatedLoser, false, battleId),
      ]);
    }

    // Award economy currency
    const rewardPromises: Promise<void>[] = [];

    if (winnerUserId) {
      rewardPromises.push(awardBattleCrowns(winnerUserId, battleId).catch(() => undefined));
      rewardPromises.push(awardParticipationTokens(winnerUserId, battleId).catch(() => undefined));
    }
    if (loserUserId && loserUserId !== winnerUserId) {
      rewardPromises.push(awardParticipationTokens(loserUserId, battleId).catch(() => undefined));
    }

    await Promise.all(rewardPromises);
  } catch {
    // Non-critical — swallow all errors
  }
}
