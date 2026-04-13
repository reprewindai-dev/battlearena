import { createClient } from "@supabase/supabase-js";

import { env } from "@/env";

export function createSupabaseServiceRoleClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("Supabase service role is not configured.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
