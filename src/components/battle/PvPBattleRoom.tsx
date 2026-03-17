"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PvPBattleRoomProps {
  match: {
    matchId?: string | null;
    battleId?: string | null;
  };
  onBattleEnd?: (result: unknown) => void;
}

export function PvPBattleRoom({ match }: PvPBattleRoomProps) {
  const router = useRouter();
  const battleId = match.battleId ?? match.matchId ?? null;

  useEffect(() => {
    if (!battleId) return;
    router.replace(`/app/battles/room?battleId=${encodeURIComponent(battleId)}`);
  }, [battleId, router]);

  return (
    <Card className="p-6">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Live battle room moved</h2>
        <p className="text-sm text-muted-foreground">
          This route is deprecated. Continue in the unified live room runtime.
        </p>
        {battleId ? (
          <Button onClick={() => router.replace(`/app/battles/room?battleId=${encodeURIComponent(battleId)}`)}>
            Continue to Live Room
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
