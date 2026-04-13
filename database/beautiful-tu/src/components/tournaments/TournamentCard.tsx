"use client";

import * as React from "react";
import { Calendar, Trophy, Users, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type TournamentStatus = "upcoming" | "registration" | "live" | "completed" | "cancelled";

type TournamentCardProps = {
  tournament: {
    id: string;
    name: string;
    description: string | null;
    entry_fee_tokens: number;
    prize_pool_tokens: number;
    max_participants: number;
    status: TournamentStatus;
    starts_at: string | null;
    registration_closes: string | null;
    participant_count: Array<{ count: number }> | null;
  };
  onJoin?: (tournamentId: string) => void;
  onView?: (tournamentId: string) => void;
  isJoining?: boolean;
};

const statusColors: Record<TournamentStatus, string> = {
  upcoming: "bg-slate-500",
  registration: "bg-blue-500",
  live: "bg-green-500",
  completed: "bg-neutral-500",
  cancelled: "bg-red-500",
};

export function TournamentCard({ tournament, onJoin, onView, isJoining }: TournamentCardProps) {
  const currentParticipants = tournament.participant_count?.[0]?.count ?? 0;
  const registrationDeadlinePassed =
    tournament.registration_closes ? new Date(tournament.registration_closes).getTime() <= Date.now() : false;
  const canJoin =
    tournament.status === "registration" &&
    !registrationDeadlinePassed &&
    currentParticipants < tournament.max_participants;

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {tournament.name}
            </CardTitle>
            <CardDescription>{tournament.description ?? "Tournament battle bracket and prize competition."}</CardDescription>
          </div>
          <Badge className={statusColors[tournament.status]}>{tournament.status.toUpperCase()}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Entry Fee</p>
              <p className="text-sm text-muted-foreground">{tournament.entry_fee_tokens} tokens</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Prize Pool</p>
              <p className="text-sm text-muted-foreground">{tournament.prize_pool_tokens} tokens</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Participants</p>
              <p className="text-sm text-muted-foreground">
                {currentParticipants} / {tournament.max_participants}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Starts</p>
              <p className="text-sm text-muted-foreground">
                {tournament.starts_at ? new Date(tournament.starts_at).toLocaleDateString() : "TBD"}
              </p>
            </div>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-secondary">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{
              width: `${Math.min((currentParticipants / tournament.max_participants) * 100, 100)}%`,
            }}
          />
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        {canJoin && onJoin ? (
          <Button onClick={() => onJoin(tournament.id)} disabled={isJoining} className="flex-1">
            {isJoining ? "Joining..." : `Join Tournament (${tournament.entry_fee_tokens} tokens)`}
          </Button>
        ) : null}

        {onView ? (
          <Button
            variant="outline"
            onClick={() => onView(tournament.id)}
            className={canJoin ? "w-auto" : "flex-1"}
          >
            View Details
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
