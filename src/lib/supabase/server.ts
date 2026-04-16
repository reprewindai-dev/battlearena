import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

export async function createSupabaseServerClient(): Promise<any> {
  const cookieStore = await cookies();
  const publicKey = getSupabasePublicKey();
  const url = getSupabaseUrl();

  if (!url || !publicKey) {
    return null;
  }

  return createServerClient(
    url,
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
