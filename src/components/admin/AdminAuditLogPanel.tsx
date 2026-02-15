"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  payload: unknown;
  created_at: string;
};

type AuditLogResponse =
  | { ok: true; mode: "mock" | "supabase"; rows: AuditLogRow[] }
  | { error: string; details?: string };

export function AdminAuditLogPanel() {
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<AuditLogResponse | null>(null);
  const [q, setQ] = React.useState("");
  const [action, setAction] = React.useState("");
  const [limit, setLimit] = React.useState("100");

  async function load() {
    const parsed = Number(limit);
    const safeLimit = Number.isFinite(parsed) ? Math.max(1, Math.min(500, Math.floor(parsed))) : 100;

    setRunning(true);
    try {
      const url = new URL("/api/admin/audit-log", window.location.origin);
      url.searchParams.set("limit", String(safeLimit));
      if (q.trim().length > 0) url.searchParams.set("q", q.trim());
      if (action.trim().length > 0) url.searchParams.set("action", action.trim());

      const res = await fetch(url.toString(), { method: "GET" });
      const body = (await res.json()) as AuditLogResponse;
      setResult(body);
    } catch {
      setResult({ error: "request_failed" });
    } finally {
      setRunning(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Audit log</div>
        <Button onClick={() => void load()} disabled={running} variant="outline" size="sm">
          {running ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Query</div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Action</div>
            <Input value={action} onChange={(e) => setAction(e.target.value)} className="w-56" />
          </div>
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">Limit</div>
            <Input value={limit} onChange={(e) => setLimit(e.target.value)} className="w-24" />
          </div>
          <Button onClick={() => void load()} disabled={running}>
            Apply
          </Button>
        </div>

        {result && "ok" in result ? (
          <div className="max-h-96 overflow-auto rounded-lg border border-border/60 bg-background/25">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[180px_140px_180px_1fr] gap-2 border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                <div>When</div>
                <div>Actor</div>
                <div>Action</div>
                <div>Payload</div>
              </div>
              {result.rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[180px_140px_180px_1fr] gap-2 border-b border-border/60 px-3 py-2 text-xs"
                >
                  <div className="text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </div>
                  <div className="font-mono text-muted-foreground">
                    {row.actor_user_id ? row.actor_user_id.slice(0, 8) : "(cron)"}
                  </div>
                  <div className="font-mono">{row.action}</div>
                  <pre className="overflow-auto whitespace-pre-wrap break-words text-muted-foreground">
                    {JSON.stringify(row.payload, null, 2)}
                  </pre>
                </div>
              ))}
              {result.rows.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">No entries.</div>
              ) : null}
            </div>
          </div>
        ) : result && "error" in result ? (
          <div className="text-xs text-amber-200/90">Unable to load audit log.</div>
        ) : null}
      </div>
    </Card>
  );
}
