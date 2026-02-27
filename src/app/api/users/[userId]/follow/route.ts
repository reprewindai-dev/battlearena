import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET - check follow status
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ is_following: false });
  }

  const { data } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", userId)
    .maybeSingle();

  return NextResponse.json({ is_following: !!data });
}

// POST - follow
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.id === userId) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: userId });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, already_following: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create notification for followed user
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "follow",
    title: "New follower",
    body: "Someone started following you",
    actor_id: user.id,
    link: `/app/players/${user.id}`,
  });

  return NextResponse.json({ ok: true });
}

// DELETE - unfollow
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
