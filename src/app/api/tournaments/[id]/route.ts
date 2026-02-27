import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Fetch tournament
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  // Fetch participants with their profiles
  const { data: participants } = await supabase
    .from("tournament_participants")
    .select(`
      id,
      status,
      seed,
      final_placement,
      registered_at,
      user_profiles (
        id,
        handle,
        display_name,
        avatar_url,
        elo_rating,
        tier
      )
    `)
    .eq("tournament_id", id)
    .order("seed", { ascending: true, nullsFirst: false });

  // Count confirmed participants
  const participant_count = (participants ?? []).filter(
    (p) => p.status === "confirmed" || p.status === "registered"
  ).length;

  return NextResponse.json({
    tournament: { ...tournament, participant_count },
    participants: participants ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Admin-only: update tournament status/details
  const role = user.app_metadata?.role ?? "user";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const allowed = ["status", "name", "description", "registration_deadline", "starts_at", "bracket_data"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("tournaments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tournament: data });
}
