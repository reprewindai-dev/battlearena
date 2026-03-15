import { cookies } from "next/headers";

import { type AppRole } from "@/lib/auth/config";
import { isMockRuntimeEnabled } from "@/lib/auth/mock-runtime";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const forceMockAuth = isMockRuntimeEnabled();
  if (forceMockAuth && cookieStore.get("arena_mock_session")?.value === "1") {
    const mockUserId = cookieStore.get("arena_mock_user_id")?.value?.trim() || "mock-user";
    return {
      id: mockUserId,
      email: `${mockUserId}@mock.local`,
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? null,
  };
}

export async function getSessionRole(): Promise<AppRole> {
  const cookieStore = await cookies();
  const forceMockAuth = isMockRuntimeEnabled();
  if (forceMockAuth && cookieStore.get("arena_mock_session")?.value === "1") {
    const forcedRole = cookieStore.get("arena_role")?.value;
    if (forcedRole === "admin" || forcedRole === "mod" || forcedRole === "user") {
      return forcedRole;
    }
  }

  const role = cookieStore.get("arena_role")?.value;
  if (role === "admin" || role === "mod" || role === "user") return role;

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return "user";

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
