"use client";

import * as React from "react";
import { Trophy, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type MatchStatus = "pending" | "in_progress" | "completed" | "walkover" | "cancelled";

type MatchPlayer = {
  id: string;
  handle: string;
  display_name: string | null;
};

type BracketMatch = {
  id: string;
  round: number;
  match_number: number;
  bracket_position: string | null;
  player_a_id: string | null;
  player_b_id: string | null;
  winner_id: string | null;
  score_a: number | null;
  score_b: number | null;
  status: MatchStatus;
  player_a?: MatchPlayer | null;
  player_b?: MatchPlayer | null;
};

type TournamentInfo = {
  id: string;
  name: string;
  status: string;
  format: string;
  prize_pool_tokens: number;
};

interface TournamentBracketProps {
  tournamentId: string;
  isAdmin?: boolean;
}

const STATUS_ICON = {
  pending: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  in_progress: <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />,
  completed: <CheckCircle className="h-3.5 w-3.5 text-green-400" />,
  walkover: <CheckCircle className="h-3.5 w-3.5 text-slate-400" />,
  cancelled: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
};

function MatchCard({
  match,
  isAdmin,
  onResult,
}: {
  match: BracketMatch;
  isAdmin: boolean;
  onResult: (matchId: string, winnerId: string) => void;
}) {
  const playerA = match.player_a;
  const playerB = match.player_b;
  const isCompleted = match.status === "completed" || match.status === "walkover";

  return (
    <div className="flex w-48 flex-col rounded-lg border border-border/60 bg-card/30 text-xs overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-2 py-1">
        <span className="font-mono text-[10px] text-muted-foreground">{match.bracket_position ?? `R${match.round}M${match.match_number}`}</span>
        {STATUS_ICON[match.status] ?? null}
      </div>

      {/* Player A */}
      <div
        className={`flex items-center justify-between gap-2 px-2 py-1.5 ${
          match.winner_id === match.player_a_id && match.player_a_id ? "bg-green-500/10" : ""
        }`}
      >
        <span className={`truncate font-medium ${!playerA ? "italic text-muted-foreground" : ""}`}>
          {playerA?.display_name ?? playerA?.handle ?? "TBD"}
        </span>
        {match.score_a != null && <span className="font-mono font-bold">{match.score_a}</span>}
        {isAdmin && !isCompleted && match.player_a_id && (
          <button
            onClick={() => onResult(match.id, match.player_a_id!)}
            className="rounded bg-green-500/20 px-1 py-0.5 text-[9px] font-semibold text-green-400 hover:bg-green-500/30"
          >
            WIN
          </button>
        )}
      </div>

      <div className="border-t border-border/40" />

      {/* Player B */}
      <div
        className={`flex items-center justify-between gap-2 px-2 py-1.5 ${
          match.winner_id === match.player_b_id && match.player_b_id ? "bg-green-500/10" : ""
        }`}
      >
        <span className={`truncate font-medium ${!playerB ? "italic text-muted-foreground" : ""}`}>
          {playerB?.display_name ?? playerB?.handle ?? "TBD"}
        </span>
        {match.score_b != null && <span className="font-mono font-bold">{match.score_b}</span>}
        {isAdmin && !isCompleted && match.player_b_id && (
          <button
            onClick={() => onResult(match.id, match.player_b_id!)}
            className="rounded bg-green-500/20 px-1 py-0.5 text-[9px] font-semibold text-green-400 hover:bg-green-500/30"
          >
            WIN
          </button>
        )}
      </div>
    </div>
  );
}

export function TournamentBracket({ tournamentId, isAdmin = false }: TournamentBracketProps) {
  const [matches, setMatches] = React.useState<BracketMatch[]>([]);
  const [tournament, setTournament] = React.useState<TournamentInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [distributing, setDistributing] = React.useState(false);

  const fetchBracket = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/bracket`);
      if (!res.ok) return;
      const data = await res.json() as { tournament: TournamentInfo; matches: BracketMatch[] };
      setTournament(data.tournament);
      setMatches(data.matches ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  React.useEffect(() => { void fetchBracket(); }, [fetchBracket]);

  async function handleGenerateBracket() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/bracket`, { method: "POST" });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to generate bracket"); return; }
      toast.success("Bracket generated!");
      await fetchBracket();
    } finally {
      setGenerating(false);
    }
  }

  async function handleMatchResult(matchId: string, winnerId: string) {
    const res = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winner_id: winnerId, score_a: 1, score_b: 0 }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) { toast.error(data.error ?? "Failed to record result"); return; }
    toast.success("Match result recorded.");
    await fetchBracket();
  }

  async function handleDistributePrizes() {
    setDistributing(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/distribute-prizes`, { method: "POST" });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to distribute prizes"); return; }
      toast.success("Prizes distributed!");
    } finally {
      setDistributing(false);
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading bracket…</div>;

  // Organize by round
  const roundMap = new Map<number, BracketMatch[]>();
  for (const m of matches) {
    const list = roundMap.get(m.round) ?? [];
    list.push({ ...m });
    roundMap.set(m.round, list);
  }
  const rounds = Array.from(roundMap.keys()).sort((a, b) => a - b);

  const totalRounds = rounds.length;
  function getRoundName(round: number): string {
    const fromEnd = totalRounds - round;
    if (fromEnd === 0) return "Final";
    if (fromEnd === 1) return "Semi-Finals";
    if (fromEnd === 2) return "Quarter-Finals";
    return `Round ${round}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="font-semibold">Bracket</span>
          {tournament && (
            <Badge variant="outline" className="text-xs">
              {tournament.format.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        {isAdmin && matches.length === 0 && tournament && ["registration", "upcoming"].includes(tournament.status) && (
          <Button size="sm" onClick={() => void handleGenerateBracket()} disabled={generating}>
            {generating ? "Generating…" : "Generate Bracket"}
          </Button>
        )}
        {isAdmin && tournament?.status === "completed" && (
          <Button size="sm" variant="outline" onClick={() => void handleDistributePrizes()} disabled={distributing}>
            {distributing ? "Distributing…" : "Distribute Prizes"}
          </Button>
        )}
      </div>

      {matches.length === 0 ? (
        <Card className="border-border/60 bg-card/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "No bracket yet. Click \"Generate Bracket\" once registration is closed."
              : "The bracket hasn't been generated yet. Check back soon."}
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-8 min-w-max">
            {rounds.map((round) => {
              const roundMatches = (roundMap.get(round) ?? []).sort((a, b) => a.match_number - b.match_number);
              return (
                <div key={round} className="flex flex-col gap-4">
                  <div className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {getRoundName(round)}
                  </div>
                  <div className="flex flex-col gap-6 justify-around flex-1">
                    {roundMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        isAdmin={isAdmin}
                        onResult={handleMatchResult}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
