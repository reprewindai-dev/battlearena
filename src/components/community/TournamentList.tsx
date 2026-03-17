"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Calendar, Clock, Trophy, Users, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Tournament = {
  id: string;
  name: string;
  description: string | null;
  status: "upcoming" | "registration" | "live" | "completed" | "cancelled";
  format: string;
  max_participants: number;
  entry_fee_tokens: number;
  prize_pool_tokens: number;
  starts_at: string;
  registration_ends_at: string;
  created_at: string;
  participant_count: Array<{ count: number }>;
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  registration: "bg-green-500/10 text-green-400 border-green-500/30",
  live: "bg-red-500/10 text-red-400 border-red-500/30",
  completed: "bg-muted/30 text-muted-foreground border-muted/30",
  cancelled: "bg-muted/30 text-muted-foreground/50 border-muted/30",
};

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const [registering, setRegistering] = React.useState(false);
  const participantCount = tournament.participant_count?.[0]?.count ?? 0;
  const isFull = participantCount >= tournament.max_participants;
  const regOpen =
    tournament.status === "registration" &&
    new Date(tournament.registration_ends_at) > new Date();

  async function handleRegister() {
    setRegistering(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/register`, {
        method: "POST",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Registration failed");
        return;
      }
      toast.success(`Registered for ${tournament.name}!`);
    } catch {
      toast.error("Network error");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <Card className="border-border/60 bg-card/30 p-5 backdrop-blur transition-colors hover:bg-card/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 shrink-0 text-yellow-400" />
            <Link
              href={`/app/tournaments/${tournament.id}`}
              className="truncate font-semibold hover:underline"
            >
              {tournament.name}
            </Link>
          </div>
          {tournament.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {tournament.description}
            </p>
          ) : null}
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 text-xs ${STATUS_COLORS[tournament.status] ?? ""}`}
        >
          {tournament.status === "live"
            ? "LIVE"
            : tournament.status.replace("_", " ").toUpperCase()}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" /> Players
          </div>
          <div className={`font-medium ${isFull ? "text-red-400" : ""}`}>
            {participantCount}/{tournament.max_participants}
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" /> Entry
          </div>
          <div className="font-medium">
            {tournament.entry_fee_tokens === 0
              ? "Free"
              : `${tournament.entry_fee_tokens} tokens`}
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Trophy className="h-3 w-3" /> Prize
          </div>
          <div className="font-medium text-yellow-400">
            {tournament.prize_pool_tokens === 0
              ? "-"
              : `${tournament.prize_pool_tokens} tokens`}
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" /> Starts
          </div>
          <div className="font-medium">
            {new Date(tournament.starts_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {regOpen ? (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Reg closes {new Date(tournament.registration_ends_at).toLocaleDateString()}
          </div>
          <Button
            size="sm"
            className="ml-auto"
            onClick={handleRegister}
            disabled={registering || isFull}
          >
            {registering ? "Registering..." : isFull ? "Full" : "Register"}
          </Button>
        </div>
      ) : null}

      {tournament.status === "live" ? (
        <div className="mt-4">
          <Button asChild size="sm" variant="destructive" className="w-full">
            <Link href={`/app/tournaments/${tournament.id}`}>Watch Live</Link>
          </Button>
        </div>
      ) : null}

      {tournament.status !== "live" && !regOpen ? (
        <div className="mt-4 flex justify-end">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/app/tournaments/${tournament.id}`}>View Details</Link>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function TournamentList({ status }: { status?: string }) {
  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState(status ?? "all");

  React.useEffect(() => {
    setLoading(true);
    const params = filter !== "all" ? `?status=${filter}` : "";
    fetch(`/api/tournaments${params}`)
      .then((r) => r.json())
      .then((d) => setTournaments((d as { tournaments?: Tournament[] }).tournaments ?? []))
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tournaments</h2>
        <div className="flex gap-1">
          {["all", "registration", "live", "upcoming", "completed"].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted/30" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <Card className="border-border/60 bg-card/30 p-8 text-center">
          <Trophy className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No tournaments yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </div>
  );
}
