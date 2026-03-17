import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const headersList = await headers();
    const authHeader = headersList.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check if user has tournament access
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.subscription_tier !== "enterprise") {
      return NextResponse.json({ error: "Tournaments require Enterprise plan" }, { status: 403 });
    }

    // Get tournaments with participant counts
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select(`
        *,
        tournament_participants(count)
      `)
      .order("starts_at", { ascending: true });

    const tournamentsWithCounts = tournaments?.map(tournament => ({
      ...tournament,
      current_participants: tournament.tournament_participants[0]?.count || 0,
    })) || [];

    return NextResponse.json(tournamentsWithCounts);
  } catch (error) {
    console.error("Tournaments fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch tournaments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, entry_fee_cents, prize_pool_cents, max_participants, starts_at, ends_at, rules } = await request.json();

    if (!name || !max_participants || !starts_at) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const headersList = await headers();
    const authHeader = headersList.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check if user has tournament access
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.subscription_tier !== "enterprise") {
      return NextResponse.json({ error: "Tournament creation requires Enterprise plan" }, { status: 403 });
    }

    // Create tournament
    const { data: tournament, error: createError } = await supabase
      .from("tournaments")
      .insert({
        name,
        description,
        entry_fee_cents: entry_fee_cents || 0,
        prize_pool_cents: prize_pool_cents || 0,
        max_participants,
        starts_at,
        ends_at,
        rules: rules || {},
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Track usage
    await supabase
      .from("usage_tracking")
      .insert({
        user_id: user.id,
        event_type: "tournament_created",
        event_data: { tournament_id: tournament.id },
      });

    return NextResponse.json(tournament);
  } catch (error) {
    console.error("Tournament creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create tournament" },
      { status: 500 }
    );
  }
}
