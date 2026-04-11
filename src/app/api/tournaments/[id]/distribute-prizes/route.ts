import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { getSessionUser } from "@/lib/auth/session";
import { calculatePrizes } from "@/lib/tournaments/bracket";
import { transact } from "@/lib/economy/wallet";
import { sendSystemNotification } from "@/lib/notifications/system";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params;
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
    .select("id,name,status,prize_pool_tokens,created_by")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

  const typedTournament = tournament as {
    id: string;
    name: string;
    status: string;
    prize_pool_tokens: number;
    created_by: string;
  };

  if (!isAdmin && typedTournament.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (typedTournament.status !== "completed") {
    return NextResponse.json({ error: "Tournament must be completed before distributing prizes" }, { status: 409 });
  }

  // Check if already distributed
  const { data: existingDistributions } = await adminClient
    .from("tournament_prize_distributions")
    .select("id")
    .eq("tournament_id", tournamentId)
    .limit(1);

  if (existingDistributions && existingDistributions.length > 0) {
    return NextResponse.json({ error: "Prizes already distributed" }, { status: 409 });
  }

  // Get all matches to determine placements
  const { data: matches } = await adminClient
    .from("tournament_matches")
    .select("round,winner_id,player_a_id,player_b_id,status")
    .eq("tournament_id", tournamentId)
    .eq("status", "completed")
    .order("round", { ascending: false });

  const typedMatches = (matches ?? []) as Array<{
    round: number;
    winner_id: string | null;
    player_a_id: string | null;
    player_b_id: string | null;
    status: string;
  }>;

  if (typedMatches.length === 0) {
    return NextResponse.json({ error: "No completed matches found" }, { status: 409 });
  }

  const finalMatch = typedMatches[0];
  const winner = finalMatch.winner_id;
  const runnerUp = winner === finalMatch.player_a_id ? finalMatch.player_b_id : finalMatch.player_a_id;

  const { data: participants } = await adminClient
    .from("tournament_participants")
    .select("user_id")
    .eq("tournament_id", tournamentId)
    .eq("status", "confirmed");

  const participantCount = (participants ?? []).length;
  const prizeMap = calculatePrizes(typedTournament.prize_pool_tokens, participantCount);

  const distributions: Array<{ placement: number; userId: string; tokens: number; crowns: number }> = [];

  if (winner && prizeMap[1]) {
    distributions.push({ placement: 1, userId: winner, tokens: prizeMap[1], crowns: 50 });
  }
  if (runnerUp && prizeMap[2]) {
    distributions.push({ placement: 2, userId: runnerUp, tokens: prizeMap[2], crowns: 25 });
  }

  // Semi-finalists (round before final)
  const maxRound = Math.max(...typedMatches.map((m) => m.round));
  if (maxRound >= 2) {
    const semiMatches = typedMatches.filter((m) => m.round === maxRound - 1);
    const semiLosers = semiMatches
      .map((m) => (m.winner_id === m.player_a_id ? m.player_b_id : m.player_a_id))
      .filter(Boolean) as string[];

    let placement = 3;
    for (const loser of semiLosers) {
      if (prizeMap[placement]) {
        distributions.push({ placement, userId: loser, tokens: prizeMap[placement], crowns: 10 });
      }
      placement++;
    }
  }

  const results: Array<{ userId: string; placement: number; tokensAwarded: number; crownsAwarded: number }> = [];

  for (const dist of distributions) {
    try {
      if (dist.tokens > 0) {
        await transact({
          userId: dist.userId,
          currency: "tokens",
          amount: dist.tokens,
          type: "tournament_prize",
          description: `${typedTournament.name} - Place #${dist.placement}`,
          referenceId: tournamentId,
          referenceType: "tournament",
        });
      }
      if (dist.crowns > 0) {
        await transact({
          userId: dist.userId,
          currency: "crowns",
          amount: dist.crowns,
          type: "crown_tournament_win",
          description: `${typedTournament.name} - Place #${dist.placement}`,
          referenceId: tournamentId,
          referenceType: "tournament",
        });
      }

      await adminClient.from("tournament_prize_distributions").insert({
        tournament_id: tournamentId,
        user_id: dist.userId,
        placement: dist.placement,
        prize_tokens: dist.tokens,
        prize_crowns: dist.crowns,
      });

      await sendSystemNotification(adminClient, {
        userId: dist.userId,
        title: `Tournament prize awarded! 🏆`,
        body: `You placed #${dist.placement} in ${typedTournament.name} and earned ${dist.tokens} tokens + ${dist.crowns} crowns.`,
        link: `/app/tournaments/${tournamentId}`,
      }).catch(() => null);

      results.push({
        userId: dist.userId,
        placement: dist.placement,
        tokensAwarded: dist.tokens,
        crownsAwarded: dist.crowns,
      });
    } catch {
      // Continue distributing to others even if one fails
    }
  }

  return NextResponse.json({ ok: true, distributions: results });
}
