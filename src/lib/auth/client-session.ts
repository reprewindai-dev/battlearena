import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type SessionUser = {
  id: string;
  email: string | null;
};

export async function getClientSessionUser(): Promise<SessionUser | null> {
  const supabase = createSupabaseBrowserClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? null,
  };
}
