import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "followers"; // followers | following
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);
  const offset = Number(searchParams.get("offset") ?? "0");

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  if (type === "following") {
    const { data, error } = await supabase
      .from("follows")
      .select(`
        created_at,
        profile:user_profiles!following_id (
          id, handle, display_name, avatar_url, tier, is_verified, elo_rating
        )
      `)
      .eq("follower_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: (data ?? []).map((d: Record<string, unknown>) => d.profile), type });
  } else {
    const { data, error } = await supabase
      .from("follows")
      .select(`
        created_at,
        profile:user_profiles!follower_id (
          id, handle, display_name, avatar_url, tier, is_verified, elo_rating
        )
      `)
      .eq("following_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: (data ?? []).map((d: Record<string, unknown>) => d.profile), type });
  }
}
