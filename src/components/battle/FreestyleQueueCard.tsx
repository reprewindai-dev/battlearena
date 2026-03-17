"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { enqueue, getStatus } from "@/lib/matchmaking/client";
import { getClientSessionUser } from "@/lib/auth/client-session";
import { getMatchmaking } from "@/lib/matchmaking/client";

export function FreestyleQueueCard() {
  const [isQueued, setIsQueued] = useState(false);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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
        const status = await getStatus(user.id, "freestyle");
        setQueueStatus(status);

        if (status.matched && status.battleId) {
          setIsQueued(false);
          window.location.href = `/app/battles/room?battleId=${encodeURIComponent(status.battleId)}`;
        }
      } catch (error) {
        console.error("Failed to poll queue status:", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isQueued, user]);

  const handleJoinQueue = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await enqueue(user.id, "freestyle");
      setQueueStatus(result);

      if (result.matched && result.battleId) {
        window.location.href = `/app/battles/room?battleId=${encodeURIComponent(result.battleId)}`;
      } else {
        setIsQueued(true);
      }
    } catch (error: any) {
      console.error("Failed to join queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!user) return;

    try {
      const matchmaking = getMatchmaking();
      await matchmaking.dequeue(user.id, "freestyle");
      setIsQueued(false);
      setQueueStatus(null);
    } catch (error: any) {
      console.error("Failed to leave queue:", error);
    }
  };

  const queuedSeconds = Math.floor((queueStatus?.waitTimeMs ?? 0) / 1000);

  return (
    <Card className="p-6" data-testid="freestyle-queue-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Freestyle Battles</h3>
          <p className="text-sm text-gray-600">Practice and have fun</p>
        </div>
        <Badge variant="secondary">CASUAL</Badge>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Format:</span>
            <p className="text-gray-600">60s rounds</p>
          </div>
          <div>
            <span className="font-medium">Entry:</span>
            <p className="text-gray-600">Free</p>
          </div>
          <div>
            <span className="font-medium">Prize:</span>
            <p className="text-gray-600">None</p>
          </div>
          <div>
            <span className="font-medium">Bot fallback:</span>
            <p className="text-gray-600">20s</p>
          </div>
        </div>

        {isQueued ? (
          <div className="space-y-3">
            <div className="text-center">
              <div className="animate-pulse">
                <p className="text-sm text-gray-600">Finding opponent...</p>
                <p className="text-xs text-gray-500 mt-1">Queue time: {queuedSeconds}s</p>
              </div>
            </div>
            <Button onClick={handleLeaveQueue} variant="outline" className="w-full" disabled={loading}>
              Leave Queue
            </Button>
          </div>
        ) : (
          <Button onClick={handleJoinQueue} className="w-full" disabled={loading || !user} data-testid="freestyle-queue-join">
            {loading ? "Joining..." : "Join Freestyle Queue"}
          </Button>
        )}
      </div>
    </Card>
  );
}
