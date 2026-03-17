"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BotBattleRoomProps {
  battle: {
    id?: string | null;
    battle_id?: string | null;
  };
  onBattleEnd?: (winner: string, scores: unknown) => void;
}

export function BotBattleRoom({ battle }: BotBattleRoomProps) {
  const router = useRouter();
  const battleId = battle.id ?? battle.battle_id ?? null;

  useEffect(() => {
    if (!battleId) return;
    router.replace(`/app/battles/room?battleId=${encodeURIComponent(battleId)}`);
  }, [battleId, router]);

  return (
    <Card className="p-6">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Bot battle room moved</h2>
        <p className="text-sm text-muted-foreground">
          Bot battles now run in the same production live room runtime.
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
