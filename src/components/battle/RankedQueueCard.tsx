"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { enqueue, getStatus, type MatchmakingResult } from "@/lib/matchmaking/client";
import { getClientSessionUser, type SessionUser } from "@/lib/auth/client-session";
import { getMatchmaking } from "@/lib/matchmaking/client";

export function RankedQueueCard() {
  const [isQueued, setIsQueued] = useState(false);
  const [queueStatus, setQueueStatus] = useState<MatchmakingResult | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const sessionUser = await getClientSessionUser();
      setUser(sessionUser);
    };
    void loadUser();
  }, []);

  useEffect(() => {
    if (!isQueued || !user) return;

    const interval = setInterval(async () => {
      try {
        const status = await getStatus("ranked");
        setQueueStatus(status);
        setError(null);

        if (status.matched && status.battleId) {
          setIsQueued(false);
          window.location.href = `/app/battles/room?battleId=${encodeURIComponent(status.battleId)}`;
        }
      } catch (error) {
        console.error("Failed to poll ranked queue status:", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isQueued, user]);

  const handleJoinQueue = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await enqueue("ranked");
      setQueueStatus(result);
      setError(null);

      if (result.matched && result.battleId) {
        window.location.href = `/app/battles/room?battleId=${encodeURIComponent(result.battleId)}`;
      } else {
        setIsQueued(true);
      }
    } catch (error) {
      console.error("Failed to join ranked queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!user) return;

    try {
      const matchmaking = getMatchmaking();
      await matchmaking.dequeue("ranked");
      setIsQueued(false);
      setQueueStatus(null);
      setError(null);
    } catch (error) {
      console.error("Failed to leave ranked queue:", error);
    }
  };

  const queuedSeconds = Math.floor((queueStatus?.waitTimeMs ?? 0) / 1000);

  return (
    <Card className="p-6" data-testid="ranked-queue-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Ranked Battles</h3>
          <p className="text-sm text-gray-600">Compete for ranking and rewards</p>
        </div>
        <Badge variant="default" className="bg-red-500">
          RANKED
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Format:</span>
            <p className="text-gray-600">60s rounds</p>
          </div>
          <div>
            <span className="font-medium">Entry:</span>
            <p className="text-gray-600">Ranked ladder</p>
          </div>
          <div>
            <span className="font-medium">Prize:</span>
            <p className="text-gray-600">MMR and tier progress</p>
          </div>
          <div>
            <span className="font-medium">Bot fallback:</span>
            <p className="text-gray-600">45s (MMR neutral)</p>
          </div>
        </div>

        {isQueued ? (
          <div className="space-y-3">
            <div className="text-center">
              <div className="animate-pulse">
                <p className="text-sm text-gray-600">Finding opponent...</p>
                <p className="text-xs text-gray-500 mt-1">Queue time: {queuedSeconds}s</p>
                <p className="text-xs text-gray-500 mt-1">Bot fallback at 45s if no human match is available.</p>
              </div>
            </div>
            <Button onClick={handleLeaveQueue} variant="outline" className="w-full" disabled={loading}>
              Leave Queue
            </Button>
          </div>
        ) : (
          <Button onClick={handleJoinQueue} className="w-full" disabled={loading || !user} data-testid="ranked-queue-join">
            {loading ? "Joining..." : "Join Ranked Queue"}
          </Button>
        )}

        {queueStatus?.matched && queueStatus.isBotBattle ? (
          <div className="text-xs text-muted-foreground">Matched against a ranked bot fallback. This match is MMR neutral.</div>
        ) : null}

        {error ? <div className="text-xs text-amber-200/90">{error}</div> : null}
      </div>
    </Card>
  );
}
