"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Calendar, DollarSign } from "lucide-react";

type TournamentCardProps = {
  tournament: {
    id: string;
    name: string;
    description: string;
    entry_fee_cents: number;
    prize_pool_cents: number;
    max_participants: number;
    status: "upcoming" | "active" | "completed" | "canceled";
    starts_at: string;
    ends_at: string;
    current_participants?: number;
  };
  onJoin?: (tournamentId: string) => void;
  onView?: (tournamentId: string) => void;
  isJoining?: boolean;
};

export function TournamentCard({ tournament, onJoin, onView, isJoining }: TournamentCardProps) {
  const statusColors = {
    upcoming: "bg-blue-500",
    active: "bg-green-500",
    completed: "bg-gray-500",
    canceled: "bg-red-500",
  };

  const canJoin = tournament.status === "upcoming" && 
                  tournament.current_participants !== undefined && 
                  tournament.current_participants < tournament.max_participants;

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {tournament.name}
            </CardTitle>
            <CardDescription>{tournament.description}</CardDescription>
          </div>
          <Badge className={statusColors[tournament.status]}>
            {tournament.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Entry Fee</p>
              <p className="text-sm text-muted-foreground">
                ${tournament.entry_fee_cents / 100}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Prize Pool</p>
              <p className="text-sm text-muted-foreground">
                ${tournament.prize_pool_cents / 100}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Participants</p>
              <p className="text-sm text-muted-foreground">
                {tournament.current_participants || 0} / {tournament.max_participants}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Starts</p>
              <p className="text-sm text-muted-foreground">
                {new Date(tournament.starts_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {tournament.current_participants !== undefined && (
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all"
              style={{ 
                width: `${Math.min((tournament.current_participants / tournament.max_participants) * 100, 100)}%` 
              }}
            />
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        {canJoin && onJoin && (
          <Button 
            onClick={() => onJoin(tournament.id)}
            disabled={isJoining}
            className="flex-1"
          >
            {isJoining ? "Joining..." : `Join Tournament ($${tournament.entry_fee_cents / 100})`}
          </Button>
        )}
        
        {onView && (
          <Button 
            variant="outline" 
            onClick={() => onView(tournament.id)}
            className={canJoin ? "w-auto" : "flex-1"}
          >
            View Details
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
