import { env } from "@/env";

const DEFAULT_SUPABASE_URL = "https://xjnxrkdtdfvusofiwshu.supabase.co";
const DEFAULT_SUPABASE_PUBLIC_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqbnhya2R0ZGZ2dXNvZml3c2h1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODAxMTcsImV4cCI6MjA4NzY1NjExN30.J5U573omrKiDbgIuuTSUSd8r10mt70PDHkwK0KA0NeI";

export function getSupabaseUrl() {
  return env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
}

export function getSupabasePublicKey() {
  return (
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    env.SUPABASE_ANON_KEY ??
    DEFAULT_SUPABASE_PUBLIC_KEY
  );
}
