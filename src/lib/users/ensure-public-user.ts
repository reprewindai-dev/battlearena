import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensurePublicUserRecord(
  client: SupabaseClient,
  user: { id: string; email?: string | null },
  usernameHint?: string,
) {
  const username =
    usernameHint ??
    user.email?.split("@")[0] ??
    `user_${user.id.slice(0, 8)}`;

  const { error } = await client.from("users").upsert(
    {
      id: user.id,
      email: user.email ?? `${username}@battlearena.com`,
      username,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`user_upsert_failed:${error.message}`);
  }
}
