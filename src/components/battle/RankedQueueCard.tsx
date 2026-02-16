"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function RankedQueueCard() {
  const router = useRouter();

  const [error, setError] = React.useState<string | null>(null);
  const [isJoining, setIsJoining] = React.useState(false);
  const [isPolling, setIsPolling] = React.useState(false);

  async function pollOnce() {
    const res = await fetch("/api/matchmaking/status?mode=ranked");
    const body = (await res.json()) as
      | { ok: true; status: string; battleId: string | null }
      | { error: string; details?: string };

    if (!res.ok || !("ok" in body)) {
      return { status: "error", battleId: null } as const;
    }

    return { status: body.status, battleId: body.battleId } as const;
  }

  async function joinQueue() {
    setIsJoining(true);
    setError(null);

    try {
      const res = await fetch("/api/matchmaking/enqueue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "ranked" }),
      });
      const body = (await res.json()) as
        | { ok: true; matched: boolean; battleId: string | null }
        | { error: string; details?: string };

      if (!res.ok || !("ok" in body)) {
        setError("Unable to join queue.");
        return;
      }

      if (body.matched && body.battleId) {
        router.push(`/app/battles/room?battleId=${encodeURIComponent(body.battleId)}`);
        return;
      }

      setIsPolling(true);
      const startedAt = Date.now();
      while (Date.now() - startedAt < 30_000) {
        await new Promise((r) => window.setTimeout(r, 1500));
        const status = await pollOnce();
        if (status.status === "matched" && status.battleId) {
          router.push(`/app/battles/room?battleId=${encodeURIComponent(status.battleId)}`);
          return;
        }
      }

      setError("Still queued. Try again in a moment.");
    } catch {
      setError("Unable to join queue.");
    } finally {
      setIsPolling(false);
      setIsJoining(false);
    }
  }

  return (
    <Card
      data-testid="ranked-queue-card"
      className="border-border/60 bg-card/40 p-5 backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Ranked queue</div>
        <Badge variant="secondary">live</Badge>
      </div>
      <div className="mt-2 text-sm text-muted-foreground">
        Matchmaking MVP (same pairing logic as freestyle; mode=ranked).
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          data-testid="ranked-queue-join"
          onClick={() => void joinQueue()}
          disabled={isJoining || isPolling}
        >
          {isPolling ? "Searching…" : isJoining ? "Joining…" : "Join queue"}
        </Button>
        {error ? <div className="text-xs text-amber-200/90">{error}</div> : null}
      </div>
    </Card>
  );
}
