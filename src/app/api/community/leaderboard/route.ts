import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
  const offset = Number(searchParams.get("offset") ?? "0");
  const tier = searchParams.get("tier"); // bronze|silver|gold|platinum|diamond|legend
  const period = searchParams.get("period") ?? "all"; // all | weekly | monthly

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Use the leaderboard view
  let query = supabase
    .from("leaderboard")
    .select("*")
    .order("rank", { ascending: true })
    .range(offset, offset + limit - 1);

  if (tier) {
    query = query.eq("tier", tier);
  }

  const { data, error } = await query;
  if (error) {
    // If view doesn't exist yet, fall back to user_profiles
    const { data: fallback, error: fallbackError } = await supabase
      .from("user_profiles")
      .select("id, handle, display_name, avatar_url, elo_rating, wins, losses, total_battles, tier, is_verified")
      .eq("is_banned", false)
      .gt("total_battles", 0)
      .order("elo_rating", { ascending: false })
      .range(offset, offset + limit - 1);

    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }

    const ranked = (fallback ?? []).map((p: Record<string, unknown>, i: number) => ({
      rank: offset + i + 1,
      ...p,
      win_rate: p.total_battles ? Number(((p.wins as number) / (p.total_battles as number) * 100).toFixed(1)) : 0,
    }));

    return NextResponse.json({ entries: ranked, period });
  }

  return NextResponse.json({ entries: data ?? [], period });
}
