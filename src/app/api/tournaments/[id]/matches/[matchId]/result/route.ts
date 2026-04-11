import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { getSessionUser } from "@/lib/auth/session";

const ResultSchema = z.object({
  winner_id: z.string().uuid(),
  score_a: z.number().int().min(0).default(0),
  score_b: z.number().int().min(0).default(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const { id: tournamentId, matchId } = await params;
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

  const { data: tournament } = await adminClient
    .from("tournaments")
    .select("created_by,status")
    .eq("id", tournamentId)
    .maybeSingle();

  const typedTournament = tournament as { created_by?: string; status?: string } | null;

  if (!isAdmin && typedTournament?.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (typedTournament?.status !== "live") {
    return NextResponse.json({ error: "Tournament is not live" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = ResultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { winner_id, score_a, score_b } = parsed.data;

  const { data: match } = await adminClient
    .from("tournament_matches")
    .select("*")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const typedMatch = match as {
    round: number;
    match_number: number;
    player_a_id: string | null;
    player_b_id: string | null;
    status: string;
  };

  if (typedMatch.status === "completed") {
    return NextResponse.json({ error: "Match already completed" }, { status: 409 });
  }

  if (winner_id !== typedMatch.player_a_id && winner_id !== typedMatch.player_b_id) {
    return NextResponse.json({ error: "Winner must be one of the match participants" }, { status: 400 });
  }

  await adminClient
    .from("tournament_matches")
    .update({
      winner_id,
      score_a,
      score_b,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  // Advance winner to next match
  const nextRound = typedMatch.round + 1;
  const nextMatchNum = Math.ceil(typedMatch.match_number / 2);

  const { data: nextMatch } = await adminClient
    .from("tournament_matches")
    .select("id,player_a_id,player_b_id")
    .eq("tournament_id", tournamentId)
    .eq("round", nextRound)
    .eq("match_number", nextMatchNum)
    .maybeSingle();

  if (nextMatch) {
    const typedNextMatch = nextMatch as { id: string; player_a_id: string | null; player_b_id: string | null };
    const isOddMatch = typedMatch.match_number % 2 === 1;
    const updateField = isOddMatch ? "player_a_id" : "player_b_id";
    await adminClient
      .from("tournament_matches")
      .update({ [updateField]: winner_id })
      .eq("id", typedNextMatch.id);
  } else {
    // No next match - this was the final
    await adminClient
      .from("tournaments")
      .update({ status: "completed" })
      .eq("id", tournamentId);
  }

  return NextResponse.json({ ok: true, winner_id });
}
