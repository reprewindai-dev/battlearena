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
    <Card className="spitzone-panel overflow-hidden p-6" data-testid="ranked-queue-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="spitzone-kicker">Pressure queue</div>
          <h3 className="mt-2 text-2xl font-semibold text-white">Ranked Battles</h3>
          <p className="mt-1 text-sm text-white/58">MMR, tier progression, and visible status for people trying to own the room.</p>
        </div>
        <Badge className="border border-[#f2447a]/30 bg-[#f2447a]/12 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#ff96bb] shadow-none">
          ranked
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/42">Format</span>
            <p className="mt-2 text-sm font-medium text-white">60s rounds</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/42">Entry</span>
            <p className="mt-2 text-sm font-medium text-white">Ranked ladder</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/42">Prize</span>
            <p className="mt-2 text-sm font-medium text-white">MMR + tier progress</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/42">Bot fallback</span>
            <p className="mt-2 text-sm font-medium text-white">45s neutral</p>
          </div>
        </div>

        {isQueued ? (
          <div className="space-y-3">
            <div className="rounded-[1.4rem] border border-[#f2447a]/20 bg-[#f2447a]/8 px-4 py-5 text-center">
              <div className="animate-pulse">
                <p className="text-sm font-medium text-[#ff96bb]">Finding opponent...</p>
                <p className="mt-1 text-xs text-white/54">Queue time: {queuedSeconds}s</p>
                <p className="mt-1 text-xs text-white/54">Bot fallback at 45s if no human match is available.</p>
              </div>
            </div>
            <Button
              onClick={handleLeaveQueue}
              variant="outline"
              className="w-full rounded-full border-white/12 bg-white/4 text-white hover:bg-white/10"
              disabled={loading}
            >
              Leave Queue
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleJoinQueue}
            className="w-full rounded-full bg-[linear-gradient(90deg,#f2447a_0%,#ff7a1a_100%)] text-sm font-semibold text-white hover:opacity-95"
            disabled={loading || !user}
            data-testid="ranked-queue-join"
          >
            {loading ? "Joining..." : "Join Ranked Queue"}
          </Button>
        )}

        {queueStatus?.matched && queueStatus.isBotBattle ? (
          <div className="text-xs text-white/54">
            Matched against a ranked bot fallback. This match is MMR neutral.
          </div>
        ) : null}

        {error ? <div className="text-xs text-amber-200/90">{error}</div> : null}
      </div>
    </Card>
  );
}
