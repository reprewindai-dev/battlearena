import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: profile, error } = await supabase
    .from("player_stats")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Fetch achievements
  const { data: achievements } = await supabase
    .from("user_achievements")
    .select("*")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  // Fetch recent battles
  const { data: battles } = await supabase
    .from("battles")
    .select(`
      id, status, mode, created_at,
      participants:battle_participants!inner(
        user_id, slot, score
      )
    `)
    .contains("participant_ids", [userId])
    .in("status", ["complete"])
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    profile,
    achievements: achievements ?? [],
    recent_battles: battles ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const allowed = ["handle", "display_name", "bio", "avatar_url"] as const;
  type AllowedField = typeof allowed[number];
  const update: Partial<Record<AllowedField, string>> = {};

  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = String(body[key]).slice(0, 500);
  }

  if (update.handle) {
    // Validate handle: alphanumeric + underscore, 3-30 chars
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(update.handle)) {
      return NextResponse.json({ error: "Invalid handle format" }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", userId)
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
