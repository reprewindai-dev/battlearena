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
    // Fallback to users + ratings tables when the view is unavailable.
    const { data: fallback, error: fallbackError } = await supabase
      .from("users")
      .select(`
        id,
        username,
        is_verified,
        user_profiles ( display_name, avatar_url, tier ),
        user_ratings ( rating, wins, losses, tier )
      `)
      .eq("is_banned", false)
      .range(offset, offset + limit - 1);

    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }

    const rows = (fallback ?? []) as Array<Record<string, unknown>>;
    const ranked = rows
      .map((row) => {
        const ratings = Array.isArray(row.user_ratings) && row.user_ratings.length > 0
          ? (row.user_ratings[0] as Record<string, unknown>)
          : null;
        const profile = Array.isArray(row.user_profiles) && row.user_profiles.length > 0
          ? (row.user_profiles[0] as Record<string, unknown>)
          : null;
        const wins = Number(ratings?.wins ?? 0);
        const losses = Number(ratings?.losses ?? 0);
        const totalBattles = wins + losses;
        return {
          id: row.id,
          handle: row.username,
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          elo_rating: Number(ratings?.rating ?? 1000),
          wins,
          losses,
          total_battles: totalBattles,
          tier: (ratings?.tier ?? profile?.tier ?? "bronze") as string,
          is_verified: Boolean(row.is_verified),
          win_rate: totalBattles ? Number(((wins / totalBattles) * 100).toFixed(1)) : 0,
        };
      })
      .filter((row) => row.total_battles > 0)
      .sort((a, b) => (b.elo_rating - a.elo_rating) || (b.wins - a.wins))
      .map((row, index) => ({ ...row, rank: offset + index + 1 }));

    return NextResponse.json({ entries: ranked, period });
  }

  return NextResponse.json({ entries: data ?? [], period });
}
