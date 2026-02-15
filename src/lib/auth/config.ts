import { env } from "@/env";

export const isSupabaseConfigured =
  !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const forceMockAuth = process.env.ARENA_FORCE_MOCK_AUTH === "1";

export const isMockAuthEnabled = forceMockAuth || !isSupabaseConfigured;

export type AppRole = "user" | "mod" | "admin";

export const mockUser = {
  id: "mock-user",
  email: "mock@local",
};
