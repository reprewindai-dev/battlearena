import type { SupabaseClient } from "@supabase/supabase-js";

type UserRow = {
  id: string;
  username: string | null;
  created_at: string | null;
  is_verified: boolean | null;
  battles_played: number | null;
  wins: number | null;
  losses: number | null;
};

type UserProfileRow = {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  tier: string | null;
  token_balance?: number | null;
};

type UserRatingRow = {
  user_id: string;
  rating: number | string | null;
  tier: string | null;
  wins: number | null;
  losses: number | null;
};

type WalletRow = {
  crowns_balance: number | null;
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
  const [
    { data: userRow, error: userError },
    { data: profileRow, error: profileError },
    { data: ratingRow, error: ratingError },
    { count: followerCount, error: followerCountError },
    { count: followingCount, error: followingCountError },
    { data: walletRow, error: walletError },
    { data: achievements, error: achievementsError },
  ] = await Promise.all([
    client
      .from("users")
      .select("id,username,created_at,is_verified,battles_played,wins,losses")
      .eq("id", userId)
      .maybeSingle<UserRow>(),
    client
      .from("user_profiles")
      .select("user_id,display_name,bio,avatar_url,tier,token_balance")
      .eq("user_id", userId)
      .maybeSingle<UserProfileRow>(),
    client
      .from("user_ratings")
      .select("user_id,rating,tier,wins,losses")
      .eq("user_id", userId)
      .maybeSingle<UserRatingRow>(),
    client.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    client.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    client.from("wallets").select("crowns_balance").eq("user_id", userId).maybeSingle<WalletRow>(),
    client
      .from("user_achievements")
      .select("id,achievement_id,label,description,icon,rarity,earned_at")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false }),
  ]);

  if (userError) {
    throw new Error(`users_lookup_failed:${userError.message}`);
  }
  if (profileError) {
    throw new Error(`user_profile_lookup_failed:${profileError.message}`);
  }
  if (ratingError) {
    throw new Error(`user_rating_lookup_failed:${ratingError.message}`);
  }
  if (followerCountError) {
    throw new Error(`followers_count_failed:${followerCountError.message}`);
  }
  if (followingCountError) {
    throw new Error(`following_count_failed:${followingCountError.message}`);
  }
  if (walletError) {
    throw new Error(`wallet_lookup_failed:${walletError.message}`);
  }
  const achievementsMissingRelation =
    achievementsError?.message.includes("Could not find the table 'public.user_achievements'") ||
    achievementsError?.message.includes("relation \"public.user_achievements\" does not exist");

  if (achievementsError && !achievementsMissingRelation) {
    throw new Error(`user_achievements_lookup_failed:${achievementsError.message}`);
  }
  if (!userRow) {
    return null;
  }

  const wins = ratingRow?.wins ?? userRow.wins ?? 0;
  const losses = ratingRow?.losses ?? userRow.losses ?? 0;
  const totalBattles = userRow.battles_played ?? wins + losses;
  const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0;
  const tokenBalance = profileRow?.token_balance ?? walletRow?.crowns_balance ?? 0;

  return {
    profile: {
      id: userRow.id,
      handle: userRow.username ?? userRow.id.slice(0, 8),
      display_name: profileRow?.display_name ?? null,
      bio: profileRow?.bio ?? null,
      avatar_url: profileRow?.avatar_url ?? null,
      is_verified: Boolean(userRow.is_verified),
      elo_rating: Number(ratingRow?.rating ?? 1000),
      tier: ratingRow?.tier ?? profileRow?.tier ?? "bronze",
      wins,
      losses,
      total_battles: totalBattles,
      win_rate: winRate,
      token_balance: tokenBalance,
      total_earnings: 0,
      follower_count: followerCount ?? 0,
      following_count: followingCount ?? 0,
      achievement_count: achievementsMissingRelation ? 0 : achievements?.length ?? 0,
      created_at: userRow.created_at,
    },
    achievements: (achievementsMissingRelation ? [] : achievements ?? []).map((achievement: AchievementRow) => ({
      id: achievement.id,
      achievement_id: achievement.achievement_id,
      label: achievement.label ?? achievement.achievement_id,
      description: achievement.description ?? null,
      icon: achievement.icon ?? "trophy",
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
