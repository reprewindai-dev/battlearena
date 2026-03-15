"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PvPMatchmakingProps {
  playerId: string;
  playerMMR: number;
  onMatchFound?: (match: { battleId: string; opponentType: "live" | "bot" }) => void;
}

export function PvPMatchmaking({ onMatchFound }: PvPMatchmakingProps) {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const goToQueue = () => {
    setIsRedirecting(true);
    onMatchFound?.({ battleId: "", opponentType: "live" });
    router.push("/app/battles");
  };

  return (
    <Card className="p-6 max-w-md mx-auto">
      <div className="space-y-4 text-center">
        <h3 className="text-lg font-semibold">Matchmaking moved</h3>
        <p className="text-sm text-muted-foreground">
          Queue and room flow now runs through the production battle runtime.
        </p>
        <Button onClick={goToQueue} disabled={isRedirecting}>
          {isRedirecting ? "Redirecting..." : "Go to Live Queue"}
        </Button>
      </div>
    </Card>
  );
}
