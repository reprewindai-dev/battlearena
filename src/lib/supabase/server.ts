import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { env } from "@/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const publicKey =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !publicKey) {
    return null; // Return null instead of throwing error
  }

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}
