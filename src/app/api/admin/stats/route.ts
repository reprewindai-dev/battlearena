import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

export async function GET() {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseServiceRoleClient();

  const [
    usersRes,
    battlesRes,
    liveBattlesRes,
    tournamentsRes,
    openCasesRes,
    activityRes,
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("battles").select("id", { count: "exact", head: true }),
    supabase.from("battles").select("id", { count: "exact", head: true }).eq("status", "live"),
    supabase.from("tournaments").select("id", { count: "exact", head: true }),
    supabase.from("moderation_cases").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase
      .from("activity_feed")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  return NextResponse.json({
    total_users: usersRes.count ?? 0,
    total_battles: battlesRes.count ?? 0,
    live_battles: liveBattlesRes.count ?? 0,
    total_tournaments: tournamentsRes.count ?? 0,
    open_mod_cases: openCasesRes.count ?? 0,
    activity_24h: activityRes.count ?? 0,
  });
}
