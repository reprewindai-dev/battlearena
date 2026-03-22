import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

export async function ensurePublicUserRecord(
  client: SupabaseClient,
  user: { id: string; email?: string | null },
  usernameHint?: string,
) {
  const username =
    usernameHint ??
    user.email?.split("@")[0] ??
    `user_${user.id.slice(0, 8)}`;

  const writer = (() => {
    try {
      return createSupabaseServiceRoleClient();
    } catch {
      return client;
    }
  })();

  const { data: existingUser, error: existingUserError } = await writer
    .from("users")
    .select("id,username,email")
    .eq("id", user.id)
    .maybeSingle<{ id: string; username: string | null; email: string | null }>();

  if (existingUserError) {
    throw new Error(`user_lookup_failed:${existingUserError.message}`);
  }

  if (!existingUser) {
    const { error } = await writer.from("users").insert({
      id: user.id,
      email: user.email ?? `${username}@battlearena.com`,
      username,
    });

    if (error) {
      throw new Error(`user_insert_failed:${error.message}`);
    }
  } else if (!existingUser.email && user.email) {
    const { error } = await writer
      .from("users")
      .update({ email: user.email })
      .eq("id", user.id);

    if (error) {
      throw new Error(`user_email_update_failed:${error.message}`);
    }
  }

  const [profileResult, ratingResult, walletResult] = await Promise.all([
    writer.from("user_profiles").upsert(
      {
        user_id: user.id,
        display_name: username,
        tier: "bronze",
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    ),
    writer.from("user_ratings").upsert(
      {
        user_id: user.id,
        rating: 1000,
        deviation: 350,
        volatility: 0.06,
        tier: "bronze",
        tier_progress: 0,
        wins: 0,
        losses: 0,
        streak: 0,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    ),
    writer.from("wallets").upsert(
      {
        user_id: user.id,
        crowns_balance: 0,
        points_balance: 0,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    ),
  ]);

  if (profileResult.error) {
    throw new Error(`user_profile_upsert_failed:${profileResult.error.message}`);
  }
  if (ratingResult.error) {
    throw new Error(`user_rating_upsert_failed:${ratingResult.error.message}`);
  }
  if (walletResult.error) {
    throw new Error(`user_wallet_upsert_failed:${walletResult.error.message}`);
  }
}
