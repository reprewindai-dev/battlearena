import type { SupabaseClient } from "@supabase/supabase-js";

type PlayerStatsRow = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  elo_rating: number | null;
  wins: number | null;
  losses: number | null;
  total_battles: number | null;
  tier: string | null;
  is_verified: boolean | null;
  token_balance: number | null;
  total_earnings: number | string | null;
  created_at: string | null;
  win_rate: number | null;
  follower_count: number | null;
  following_count: number | null;
  achievement_count: number | null;
};

type UserProfileExtraRow = {
  id: string;
  bio: string | null;
};

type AchievementRow = {
  id: string;
  achievement_id: string;
  label: string | null;
  description: string | null;
  icon: string | null;
  rarity: string | null;
  earned_at: string | null;
};

export async function getHydratedProfile(client: SupabaseClient, userId: string) {
  const [{ data: playerStats, error: playerStatsError }, { data: extraProfile, error: extraProfileError }, { data: achievements, error: achievementsError }] =
    await Promise.all([
      client.from("player_stats").select("*").eq("id", userId).maybeSingle<PlayerStatsRow>(),
      client.from("user_profiles").select("id,bio").eq("id", userId).maybeSingle<UserProfileExtraRow>(),
      client
        .from("user_achievements")
        .select("id,achievement_id,label,description,icon,rarity,earned_at")
        .eq("user_id", userId)
        .order("earned_at", { ascending: false }),
    ]);

  if (playerStatsError) {
    throw new Error(`player_stats_lookup_failed:${playerStatsError.message}`);
  }
  if (extraProfileError) {
    throw new Error(`user_profile_lookup_failed:${extraProfileError.message}`);
  }
  if (achievementsError) {
    throw new Error(`user_achievements_lookup_failed:${achievementsError.message}`);
  }
  if (!playerStats) {
    return null;
  }

  return {
    profile: {
      id: playerStats.id,
      handle: playerStats.handle ?? playerStats.id.slice(0, 8),
      display_name: playerStats.display_name ?? null,
      bio: extraProfile?.bio ?? null,
      avatar_url: playerStats.avatar_url ?? null,
      is_verified: Boolean(playerStats.is_verified),
      elo_rating: playerStats.elo_rating ?? 1000,
      tier: playerStats.tier ?? "bronze",
      wins: playerStats.wins ?? 0,
      losses: playerStats.losses ?? 0,
      total_battles: playerStats.total_battles ?? 0,
      win_rate: playerStats.win_rate ?? 0,
      token_balance: playerStats.token_balance ?? 0,
      total_earnings: Number(playerStats.total_earnings ?? 0),
      follower_count: playerStats.follower_count ?? 0,
      following_count: playerStats.following_count ?? 0,
      achievement_count: playerStats.achievement_count ?? 0,
      created_at: playerStats.created_at,
    },
    achievements: (achievements ?? []).map((achievement) => ({
      id: achievement.id,
      achievement_id: achievement.achievement_id,
      label: achievement.label ?? achievement.achievement_id,
      description: achievement.description ?? null,
      icon: achievement.icon ?? "🏆",
      rarity:
        achievement.rarity === "rare" ||
        achievement.rarity === "epic" ||
        achievement.rarity === "legendary"
          ? achievement.rarity
          : "common",
      earned_at: achievement.earned_at ?? new Date(0).toISOString(),
    })),
  };
}
