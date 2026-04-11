import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { getSessionUser } from "@/lib/auth/session";
import { generateBracket } from "@/lib/tournaments/bracket";

type ParticipantRow = {
  id: string;
  user_id: string;
  seed_number: number | null;
  status: string;
};

type MatchRow = {
  id: string;
  round: number;
  match_number: number;
  bracket_position: string | null;
  player_a_id: string | null;
  player_b_id: string | null;
  winner_id: string | null;
  score_a: number | null;
  score_b: number | null;
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id,name,status,format,max_participants,prize_pool_tokens")
    .eq("id", id)
    .maybeSingle();

  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

  const { data: matches } = await supabase
    .from("tournament_matches")
    .select("*")
    .eq("tournament_id", id)
    .order("round")
    .order("match_number");

  return NextResponse.json({ tournament, matches: matches ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createSupabaseServiceRoleClient();

  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const typedProfile = profile as { role?: string } | null;
  const isAdmin = typedProfile?.role === "admin";
  if (!isAdmin) {
    const { data: tournament } = await adminClient
      .from("tournaments")
      .select("created_by")
      .eq("id", id)
      .maybeSingle();
    const typedTournament = tournament as { created_by?: string } | null;
    if (typedTournament?.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: tournament } = await adminClient
    .from("tournaments")
    .select("id,status,format,max_participants,prize_pool_tokens")
    .eq("id", id)
    .maybeSingle();

  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

  const typedTournament = tournament as {
    id: string;
    status: string;
    format: string;
    max_participants: number;
    prize_pool_tokens: number;
  };

  if (!["registration", "upcoming"].includes(typedTournament.status)) {
    return NextResponse.json({ error: "Bracket can only be generated for upcoming/registration tournaments" }, { status: 409 });
  }

  const { data: existingMatches } = await adminClient
    .from("tournament_matches")
    .select("id")
    .eq("tournament_id", id)
    .limit(1);

  if (existingMatches && existingMatches.length > 0) {
    return NextResponse.json({ error: "Bracket already generated" }, { status: 409 });
  }

  const { data: participantRows } = await adminClient
    .from("tournament_participants")
    .select("id,user_id,seed_number,status")
    .eq("tournament_id", id)
    .eq("status", "confirmed");

  const typedParticipants = (participantRows ?? []) as ParticipantRow[];

  if (typedParticipants.length < 2) {
    return NextResponse.json({ error: "Need at least 2 confirmed participants" }, { status: 409 });
  }

  const userIds = typedParticipants.map((p) => p.user_id);
  const { data: profileRows } = await adminClient
    .from("user_profiles")
    .select("user_id,display_name")
    .in("user_id", userIds);

  const { data: userRows } = await adminClient
    .from("users")
    .select("id,username")
    .in("id", userIds);

  const { data: ratingRows } = await adminClient
    .from("user_ratings")
    .select("user_id,rating")
    .in("user_id", userIds);

  const profileMap = new Map((profileRows ?? []).map((p: Record<string, unknown>) => [p.user_id as string, p]));
  const userMap = new Map((userRows ?? []).map((u: Record<string, unknown>) => [u.id as string, u]));
  const ratingMap = new Map((ratingRows ?? []).map((r: Record<string, unknown>) => [r.user_id as string, r]));

  const participants = typedParticipants.map((p, idx) => {
    const prof = profileMap.get(p.user_id) as Record<string, unknown> | undefined;
    const usr = userMap.get(p.user_id) as Record<string, unknown> | undefined;
    const rat = ratingMap.get(p.user_id) as Record<string, unknown> | undefined;
    return {
      id: p.user_id,
      handle: (usr?.username as string) ?? "player",
      display_name: (prof?.display_name as string | null) ?? null,
      seed: p.seed_number ?? idx + 1,
      rating: (rat?.rating as number) ?? 1500,
    };
  });

  const format = typedTournament.format as "single_elimination" | "double_elimination" | "round_robin" | "swiss";
  const bracket = generateBracket(format, participants);

  const matchInserts = bracket.matches.map((m) => ({
    tournament_id: id,
    round: m.round,
    match_number: m.match_number,
    bracket_position: m.bracket_position,
    player_a_id: m.player_a_id,
    player_b_id: m.player_b_id,
    winner_id: m.winner_id ?? null,
    status: m.status ?? "pending",
  }));

  const { data: insertedMatches, error: insertError } = await adminClient
    .from("tournament_matches")
    .insert(matchInserts)
    .select("*");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await adminClient
    .from("tournaments")
    .update({ status: "live" })
    .eq("id", id);

  return NextResponse.json({ matches: insertedMatches ?? [] }, { status: 201 });
}
