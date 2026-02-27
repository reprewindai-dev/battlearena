import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // upcoming|registration|live|completed
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
  const offset = Number(searchParams.get("offset") ?? "0");

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  let query = supabase
    .from("tournaments")
    .select(`
      id, name, description, status, format, max_participants,
      entry_fee_tokens, prize_pool_tokens, starts_at, registration_ends_at, created_at,
      creator:user_profiles!created_by (id, handle, display_name, avatar_url),
      participant_count:tournament_participants(count)
    `, { count: "exact" })
    .order("starts_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  } else {
    query = query.in("status", ["upcoming", "registration", "live"]);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tournaments: data ?? [], total: count ?? 0 });
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

  // Check admin role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    name,
    description,
    format = "single_elimination",
    max_participants = 16,
    entry_fee_tokens = 0,
    prize_pool_tokens = 0,
    starts_at,
    registration_ends_at,
  } = body;

  if (!name || !starts_at || !registration_ends_at) {
    return NextResponse.json({ error: "name, starts_at, registration_ends_at required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      name: String(name).slice(0, 100),
      description: description ? String(description).slice(0, 500) : null,
      format,
      max_participants: Number(max_participants),
      entry_fee_tokens: Number(entry_fee_tokens),
      prize_pool_tokens: Number(prize_pool_tokens),
      starts_at,
      registration_ends_at,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tournament: data }, { status: 201 });
}
