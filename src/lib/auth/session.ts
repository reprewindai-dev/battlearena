import { cookies } from "next/headers";

import { isMockAuthEnabled, mockUser, type AppRole } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  if (isMockAuthEnabled) {
    const cookieStore = await cookies();
    const mockSession = cookieStore.get("arena_mock_session")?.value === "1";
    if (!mockSession) return null;
    return mockUser;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  if (!data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}

export async function getSessionRole(): Promise<AppRole> {
  const cookieStore = await cookies();
  const role = cookieStore.get("arena_role")?.value;
  if (role === "admin" || role === "mod" || role === "user") return role;
  if (isMockAuthEnabled) {
    const mockSession = cookieStore.get("arena_mock_session")?.value === "1";
    if (mockSession) return "admin";
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const claim =
      (data.user?.app_metadata as { role?: unknown } | undefined)?.role ??
      (data.user?.user_metadata as { role?: unknown } | undefined)?.role;
    if (claim === "admin" || claim === "mod" || claim === "user") return claim;
  } catch {
    // ignore if Supabase not configured
  }

  return "user";
}
