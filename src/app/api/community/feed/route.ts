import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type FeedRow = {
  id: string;
  type: string;
  subject_id: string | null;
  subject_type: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  actor_id: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
  const offset = Number(searchParams.get("offset") ?? "0");
  const filter = searchParams.get("filter") ?? "global"; // global | following

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  let query = supabase
    .from("activity_feed")
    .select("id,type,subject_id,subject_type,meta,created_at,actor_id")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter === "following") {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = (follows ?? []).map((f: { following_id: string }) => f.following_id);
      if (followingIds.length > 0) {
        query = query.in("actor_id", followingIds);
      } else {
        return NextResponse.json({ items: [], total: 0 });
      }
    }
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const feedRows = (data ?? []) as FeedRow[];
  const actorIds = Array.from(new Set(feedRows.map((row) => row.actor_id)));

  const [{ data: users }, { data: profiles }, { data: ratings }] = await Promise.all([
    actorIds.length
      ? supabase.from("users").select("id,username,is_verified").in("id", actorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; username: string | null; is_verified: boolean | null }> }),
    actorIds.length
      ? supabase.from("user_profiles").select("user_id,display_name,avatar_url,tier").in("user_id", actorIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; display_name: string | null; avatar_url: string | null; tier: string | null }> }),
    actorIds.length
      ? supabase.from("user_ratings").select("user_id,rating,tier").in("user_id", actorIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; rating: number | null; tier: string | null }> }),
  ]);

  const usersById = new Map((users ?? []).map((row) => [row.id, row]));
  const profilesByUserId = new Map((profiles ?? []).map((row) => [row.user_id, row]));
  const ratingsByUserId = new Map((ratings ?? []).map((row) => [row.user_id, row]));

  const items = feedRows.map((row) => {
    const user = usersById.get(row.actor_id);
    const profile = profilesByUserId.get(row.actor_id);
    const rating = ratingsByUserId.get(row.actor_id);

    return {
      id: row.id,
      type: row.type,
      subject_id: row.subject_id,
      subject_type: row.subject_type,
      meta: row.meta ?? {},
      created_at: row.created_at,
      actor: {
        id: row.actor_id,
        handle: user?.username ?? row.actor_id,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        tier: rating?.tier ?? profile?.tier ?? "bronze",
        is_verified: Boolean(user?.is_verified),
        elo_rating: rating?.rating ?? 1000,
      },
    };
  });

  return NextResponse.json({ items, total: count ?? items.length });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({} as Record<string, unknown>))) as Record<string, unknown>;
  const type = typeof body.type === "string" ? body.type : "";
  const subject_id = typeof body.subject_id === "string" ? body.subject_id : null;
  const subject_type = typeof body.subject_type === "string" ? body.subject_type : null;
  const meta = typeof body.meta === "object" && body.meta !== null ? body.meta : {};

  if (!type) {
    return NextResponse.json({ error: "type required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("activity_feed")
    .insert({
      actor_id: user.id,
      type,
      subject_id: subject_id ?? null,
      subject_type: subject_type ?? null,
      meta: meta ?? {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
