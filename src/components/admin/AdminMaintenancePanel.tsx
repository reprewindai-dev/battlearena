"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CleanupResponse =
  | { ok: true; mode: "mock" | "supabase"; deleted_rows: number; deleted_objects: number }
  | { error: string; details?: string };

export function AdminMaintenancePanel() {
  const [minutes, setMinutes] = React.useState("15");
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<CleanupResponse | null>(null);

  async function runCleanup() {
    const parsed = Number(minutes);
    const safeMinutes = Number.isFinite(parsed) ? Math.max(1, Math.min(24 * 60, Math.floor(parsed))) : 15;

    setRunning(true);
    setResult(null);

    try {
      const res = await fetch(
        `/api/battle-session/recordings/cleanup-stale?minutes=${encodeURIComponent(String(safeMinutes))}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
      );
      const body = (await res.json()) as CleanupResponse;
      setResult(body);
    } catch {
      setResult({ error: "request_failed" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
      <div className="text-sm font-medium">Maintenance</div>
      <div className="mt-3 grid gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Stale cutoff (minutes)</div>
            <Input value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-40" />
          </div>
          <Button onClick={() => void runCleanup()} disabled={running}>
            {running ? "Running…" : "Cleanup stale recordings"}
          </Button>
        </div>

        {result ? (
          <pre className="max-h-64 overflow-auto rounded-lg border border-border/60 bg-background/25 p-3 text-xs text-muted-foreground">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </div>
    </Card>
  );
}
