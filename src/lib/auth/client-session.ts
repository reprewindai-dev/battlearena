import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

  const supabase = createSupabaseBrowserClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? null,
  };
}
