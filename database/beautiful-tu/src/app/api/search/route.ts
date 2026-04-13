import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchUserRow = {
  id: string;
  username: string | null;
  is_verified: boolean | null;
  is_banned: boolean | null;
  battles_played: number | null;
  wins: number | null;
  losses: number | null;
};

type SearchProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: string | null;
};

type SearchRatingRow = {
  user_id: string;
  rating: number | string | null;
  tier: string | null;
  wins: number | null;
  losses: number | null;
};

type SearchResultRow = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  elo_rating: number;
  tier: string;
  is_verified: boolean;
  wins: number;
  losses: number;
  total_battles: number;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type") ?? "users"; // users | battles
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  if (type === "users") {
    const [{ data: usersRaw, error: usersError }, { data: profilesRaw }, { data: ratingsRaw }] = await Promise.all([
      supabase
        .from("users")
        .select("id,username,is_verified,is_banned,battles_played,wins,losses")
        .eq("is_banned", false)
        .limit(limit * 2),
      supabase.from("user_profiles").select("user_id,display_name,avatar_url,tier").limit(limit * 2),
      supabase.from("user_ratings").select("user_id,rating,tier,wins,losses").limit(limit * 2),
    ]);

    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });

    const users = (usersRaw ?? []) as SearchUserRow[];
    const profiles = (profilesRaw ?? []) as SearchProfileRow[];
    const ratings = (ratingsRaw ?? []) as SearchRatingRow[];
    const qLower = q.toLowerCase();
    const profileMap = new Map<string, SearchProfileRow>(profiles.map((profile: SearchProfileRow) => [profile.user_id, profile]));
    const ratingMap = new Map<string, SearchRatingRow>(ratings.map((rating: SearchRatingRow) => [rating.user_id, rating]));

    const results = users
      .map((user: SearchUserRow) => {
        const profile = profileMap.get(user.id);
        const rating = ratingMap.get(user.id);
        const handle = user.username ?? `user_${user.id.slice(0, 8)}`;
        const displayName = profile?.display_name ?? null;
        const searchable = `${handle} ${displayName ?? ""}`.toLowerCase();
        if (!searchable.includes(qLower)) {
          return null;
        }

        const wins = rating?.wins ?? user.wins ?? 0;
        const losses = rating?.losses ?? user.losses ?? 0;

        return {
          id: user.id,
          handle,
          display_name: displayName,
          avatar_url: profile?.avatar_url ?? null,
          elo_rating: Number(rating?.rating ?? 1000),
          tier: rating?.tier ?? profile?.tier ?? "bronze",
          is_verified: Boolean(user.is_verified),
          wins,
          losses,
          total_battles: user.battles_played ?? wins + losses,
        };
      })
      .filter((row): row is SearchResultRow => row !== null)
      .sort((a: SearchResultRow, b: SearchResultRow) => b.elo_rating - a.elo_rating)
      .slice(0, limit);

    return NextResponse.json({ results, query: q, type });
  }

  if (type === "battles") {
    const { data, error } = await supabase
      .from("battles")
      .select("id, status, mode, created_at")
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ results: data ?? [], query: q, type });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
