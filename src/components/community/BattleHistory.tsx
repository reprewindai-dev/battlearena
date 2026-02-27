"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Swords, Trophy, Clock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Battle = {
  id: string;
  status: string;
  mode: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  live: "bg-red-500/10 text-red-400 border-red-500/30",
  queued: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  complete: "bg-green-500/10 text-green-400 border-green-500/30",
  canceled: "bg-muted/30 text-muted-foreground border-muted/30",
  draft: "bg-muted/30 text-muted-foreground border-muted/30",
};

export function BattleHistory({ userId }: { userId?: string }) {
  const [battles, setBattles] = React.useState<Battle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("all");

  React.useEffect(() => {
    setLoading(true);

    let supabase: ReturnType<typeof createSupabaseBrowserClient> | null = null;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      setLoading(false);
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    let query = supabase
      .from("battles")
      .select("id, status, mode, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (userId) {
      query = query.eq("created_by", userId);
    }
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    query.then(({ data, error }: { data: Battle[] | null; error: unknown }) => {
      if (!error) setBattles(data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Battle History</h2>
        <div className="flex gap-1">
          {["all", "complete", "live", "queued", "canceled"].map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/30" />
          ))}
        </div>
      ) : battles.length === 0 ? (
        <Card className="border-border/60 bg-card/30 p-8 text-center">
          <Swords className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No battles found.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {battles.map(b => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 bg-card/30 px-4 py-3 backdrop-blur"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full border border-border/60 bg-background/40 p-2">
                  {b.status === "complete" ? (
                    <Trophy className="h-4 w-4 text-yellow-400" />
                  ) : b.status === "live" ? (
                    <Swords className="h-4 w-4 text-red-400" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{b.id.slice(0, 8)}…</div>
                  <div className="text-xs text-muted-foreground">
                    {b.mode} · {new Date(b.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${STATUS_COLORS[b.status] ?? ""}`}>
                  {b.status === "live" ? "🔴 LIVE" : b.status.toUpperCase()}
                </Badge>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/battles/room?battleId=${b.id}`}>
                    {b.status === "live" ? "Watch" : "View"}
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
