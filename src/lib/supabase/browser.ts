import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const publicKey = getSupabasePublicKey();
  const url = getSupabaseUrl();

  if (!url || !publicKey) {
    throw new Error(
      "Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY).",
    );
  }

  return createBrowserClient(url, publicKey);
}
