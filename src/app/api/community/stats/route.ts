import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const [profilesResult, battlesResult, tournamentsResult] = await Promise.all([
    supabase.from("user_profiles").select("id", { count: "exact", head: true }),
    supabase.from("battles").select("id", { count: "exact", head: true }),
    supabase.from("tournaments").select("id", { count: "exact", head: true }),
  ]);

  const totalPlayers = profilesResult.count ?? 0;
  const totalBattles = battlesResult.count ?? 0;
  const totalTournaments = tournamentsResult.count ?? 0;

  // Live battles
  const { count: liveBattles } = await supabase
    .from("battles")
    .select("id", { count: "exact", head: true })
    .eq("status", "live");

  return NextResponse.json({
    total_players: totalPlayers,
    total_battles: totalBattles,
    live_battles: liveBattles ?? 0,
    total_tournaments: totalTournaments,
  });
}
