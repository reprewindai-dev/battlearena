import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isMockRuntimeEnabled } from "@/lib/auth/mock-runtime";

export type SessionUser = {
  id: string;
  email: string | null;
};

export async function getClientSessionUser(): Promise<SessionUser | null> {
  try {
    const res = await fetch("/api/session", { method: "GET" });
    if (res.ok) {
      const body = (await res.json()) as { ok?: boolean; user?: SessionUser | null };
      if (body.ok && body.user?.id) {
        return body.user;
      }
    }
  } catch {
    // continue with local fallbacks
  }

  const forceMockAuth = isMockRuntimeEnabled();
  if (forceMockAuth && typeof document !== "undefined") {
    const rawCookies = document.cookie.split(";").map((v) => v.trim());
    const hasMockSession = rawCookies.some((v) => v === "arena_mock_session=1");
    if (hasMockSession) {
      const mockUserCookie = rawCookies.find((v) => v.startsWith("arena_mock_user_id="));
      const mockUserId = mockUserCookie?.split("=")[1] || "mock-user";
      return {
        id: decodeURIComponent(mockUserId),
        email: `${decodeURIComponent(mockUserId)}@mock.local`,
      };
    }
  }

  const supabase = createSupabaseBrowserClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? null,
  };
}
