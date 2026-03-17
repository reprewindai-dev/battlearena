import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { data: tournament, error: tErr } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (tErr || !tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  if (!["upcoming", "registration"].includes(tournament.status)) {
    return NextResponse.json({ error: "Registration is closed" }, { status: 400 });
  }

  if (new Date(tournament.registration_closes) < new Date()) {
    return NextResponse.json({ error: "Registration deadline passed" }, { status: 400 });
  }

  // Check current participant count
  const { count } = await supabase
    .from("tournament_participants")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", id);

  if ((count ?? 0) >= tournament.max_participants) {
    return NextResponse.json({ error: "Tournament is full" }, { status: 400 });
  }

  // Deduct entry fee if applicable
  if (tournament.entry_fee_tokens > 0) {
    const { data: wallet } = await supabase
      .from("wallets")
      .select("crowns_balance")
      .eq("user_id", user.id)
      .maybeSingle();

    const balance = wallet?.crowns_balance ?? 0;
    if (balance < tournament.entry_fee_tokens) {
      return NextResponse.json({ error: "Insufficient tokens" }, { status: 400 });
    }

    await supabase
      .from("wallets")
      .upsert(
        { user_id: user.id, crowns_balance: balance - tournament.entry_fee_tokens },
        { onConflict: "user_id" },
      );

    await supabase.from("token_transactions").insert({
      user_id: user.id,
      recipient_id: tournament.created_by,
      tokens_spent: tournament.entry_fee_tokens,
      points_earned: 0,
      platform_share: 0,
      transaction_type: "tournament_entry_fee",
      reference_id: id,
    });
  }

  const { data, error } = await supabase
    .from("tournament_participants")
    .insert({ tournament_id: id, user_id: user.id, status: "registered" })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create activity feed entry
  await supabase.from("activity_feed").insert({
    actor_id: user.id,
    type: "joined_tournament",
    subject_id: id,
    subject_type: "tournament",
    meta: { tournament_name: tournament.name },
  });

  return NextResponse.json({ participant: data }, { status: 201 });
}
