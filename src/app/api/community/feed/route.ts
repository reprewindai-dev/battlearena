import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    .select(`
      id,
      type,
      subject_id,
      subject_type,
      meta,
      created_at,
      actor:user_profiles!actor_id (
        id, handle, display_name, avatar_url, tier, is_verified, elo_rating
      )
    `)
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

  return NextResponse.json({ items: data ?? [], total: count ?? 0 });
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

  const body = await req.json();
  const { type, subject_id, subject_type, meta } = body;

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
