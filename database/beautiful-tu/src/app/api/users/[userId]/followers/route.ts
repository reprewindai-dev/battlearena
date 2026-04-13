import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type FollowRow = {
  created_at: string;
  follower_id?: string;
  following_id?: string;
};
type UserRow = { id: string; username: string | null; is_verified: boolean | null };
type UserProfileRow = { user_id: string; display_name: string | null; avatar_url: string | null; tier: string | null };
type UserRatingRow = { user_id: string; rating: number | null; tier: string | null };

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "followers";
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);
  const offset = Number(searchParams.get("offset") ?? "0");

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const column = type === "following" ? "follower_id" : "following_id";
  const targetColumn = type === "following" ? "following_id" : "follower_id";

  const { data: follows, error } = await supabase
    .from("follows")
    .select(`created_at,${targetColumn}`)
    .eq(column, userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const targetIds = Array.from(
    new Set(
      ((follows ?? []) as FollowRow[])
        .map((row) => (targetColumn === "following_id" ? row.following_id : row.follower_id))
        .filter((id: string | undefined): id is string => typeof id === "string"),
    ),
  );

  const [{ data: users }, { data: profiles }, { data: ratings }] = await Promise.all([
    targetIds.length
      ? supabase.from("users").select("id,username,is_verified").in("id", targetIds)
      : Promise.resolve({ data: [] as UserRow[] }),
    targetIds.length
      ? supabase.from("user_profiles").select("user_id,display_name,avatar_url,tier").in("user_id", targetIds)
      : Promise.resolve({ data: [] as UserProfileRow[] }),
    targetIds.length
      ? supabase.from("user_ratings").select("user_id,rating,tier").in("user_id", targetIds)
      : Promise.resolve({ data: [] as UserRatingRow[] }),
  ]);

  const usersById = new Map<string, UserRow>(((users ?? []) as UserRow[]).map((row) => [row.id, row]));
  const profilesById = new Map<string, UserProfileRow>(
    ((profiles ?? []) as UserProfileRow[]).map((row) => [row.user_id, row]),
  );
  const ratingsById = new Map<string, UserRatingRow>(
    ((ratings ?? []) as UserRatingRow[]).map((row) => [row.user_id, row]),
  );

  const hydratedUsers = targetIds.map((id) => {
    const user = usersById.get(id);
    const profile = profilesById.get(id);
    const rating = ratingsById.get(id);
    return {
      id,
      handle: user?.username ?? id.slice(0, 8),
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      tier: rating?.tier ?? profile?.tier ?? "bronze",
      is_verified: Boolean(user?.is_verified),
      elo_rating: rating?.rating ?? 1000,
    };
  });

  return NextResponse.json({ users: hydratedUsers, type });
}
