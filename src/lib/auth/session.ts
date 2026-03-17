import { type AppRole } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
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
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  
  if (!data.user) return "user";

  // Check role from JWT claims
  const claim =
    (data.user.app_metadata as { role?: unknown } | undefined)?.role ??
    (data.user.user_metadata as { role?: unknown } | undefined)?.role;
  if (claim === "admin" || claim === "mod" || claim === "user") return claim;

  // Check role from database
  const { data: assignments } = await supabase
    .from("role_assignments")
    .select("roles(name)")
    .eq("user_id", data.user.id);

  const roles = assignments?.map((a) => (a.roles as { name: string }[])?.[0]?.name).filter(Boolean) || [];
  if (roles.includes("admin")) return "admin";
  if (roles.includes("mod")) return "mod";

  return "user";
}
