import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET - list my challenges (incoming + outgoing)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const direction = searchParams.get("direction") ?? "incoming"; // incoming | outgoing

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const field = direction === "outgoing" ? "challenger_id" : "challenged_id";

  const { data, error } = await supabase
    .from("challenges")
    .select(`
      id, status, battle_mode, wager_tokens, message, expires_at, created_at,
      challenger:user_profiles!challenger_id (
        id, handle, display_name, avatar_url, elo_rating, tier
      ),
      challenged:user_profiles!challenged_id (
        id, handle, display_name, avatar_url, elo_rating, tier
      )
    `)
    .eq(field, user.id)
    .in("status", ["pending"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ challenges: data ?? [] });
}

// POST - create challenge
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
  const { challenged_id, battle_mode = "freestyle", wager_tokens, message } = body;

  if (!challenged_id) {
    return NextResponse.json({ error: "challenged_id required" }, { status: 400 });
  }

  if (challenged_id === user.id) {
    return NextResponse.json({ error: "Cannot challenge yourself" }, { status: 400 });
  }

  // Check for existing pending challenge
  const { data: existing } = await supabase
    .from("challenges")
    .select("id")
    .eq("challenger_id", user.id)
    .eq("challenged_id", challenged_id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Challenge already pending" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      challenger_id: user.id,
      challenged_id,
      battle_mode,
      wager_tokens: wager_tokens ?? null,
      message: message ? String(message).slice(0, 280) : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify challenged user
  await supabase.from("notifications").insert({
    user_id: challenged_id,
    type: "challenge",
    title: "You've been challenged!",
    body: message ? message.slice(0, 100) : "Someone challenged you to a battle.",
    actor_id: user.id,
    link: `/app/challenges`,
  });

  return NextResponse.json({ challenge: data }, { status: 201 });
}
