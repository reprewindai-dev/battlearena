import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

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
      id, name, description, status, format, max_participants, tournament_type,
      entry_fee_tokens, prize_pool_tokens, starts_at, registration_closes, registration_opens, created_at,
      created_by,
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

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    format: string;
    max_participants: number;
    tournament_type: string | null;
    entry_fee_tokens: number;
    prize_pool_tokens: number;
    starts_at: string | null;
    registration_closes: string | null;
    registration_opens: string | null;
    created_at: string;
    created_by: string | null;
    participant_count: Array<{ count: number }>;
  }>;

  return NextResponse.json({
    tournaments: rows.map((row) => ({
      ...row,
      registration_ends_at: row.registration_closes,
    })),
    total: count ?? 0,
  });
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
  try {
    await ensurePublicUserRecord(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "user_bootstrap_failed" }, { status: 400 });
  }

  const role = (user.app_metadata as { role?: string } | undefined)?.role ?? "user";
  if (role !== "admin" && role !== "mod") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name,
    description,
    format = "single_elimination",
    tournament_type = "open",
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
      tournament_type,
      max_participants: Number(max_participants),
      entry_fee_tokens: Number(entry_fee_tokens),
      prize_pool_tokens: Number(prize_pool_tokens),
      starts_at,
      registration_closes: registration_ends_at,
      registration_opens: new Date().toISOString(),
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tournament: data }, { status: 201 });
}
