import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("player_stats")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // Auto-create profile if missing
    const { data: newProfile } = await supabase
      .from("user_profiles")
      .upsert({ id: user.id, handle: user.email?.split("@")[0] ?? user.id.slice(0, 8) })
      .select()
      .single();

    return NextResponse.json({ profile: newProfile ?? null });
  }

  const { data: achievements } = await supabase
    .from("user_achievements")
    .select("*")
    .eq("user_id", user.id)
    .order("earned_at", { ascending: false });

  const { data: pendingChallenges } = await supabase
    .from("challenges")
    .select("id, challenger_id, battle_mode, message, created_at")
    .eq("challenged_id", user.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());

  return NextResponse.json({
    profile,
    achievements: achievements ?? [],
    pending_challenges: pendingChallenges ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const allowed = ["handle", "display_name", "bio", "avatar_url"] as const;
  type AllowedField = typeof allowed[number];
  const update: Partial<Record<AllowedField, string>> = {};

  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = String(body[key]).slice(0, 500);
  }

  if (update.handle && !/^[a-zA-Z0-9_]{3,30}$/.test(update.handle)) {
    return NextResponse.json({ error: "Handle must be 3-30 chars, alphanumeric + underscore" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Handle already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
