import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createSupabasePublicClient() {
  const url = getSupabaseUrl();
  const key = getSupabasePublicKey();

  if (!url || !key) {
    throw new Error("Supabase public client is not configured.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
