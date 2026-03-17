import { env } from "@/env";

export const isSupabaseConfigured =
  !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Production mode - no mocks
export const isMockAuthEnabled = false;

export type AppRole = "user" | "mod" | "admin";
