"use client";

import * as React from "react";
import { Users, Swords, Trophy, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";

type Stats = {
  total_players: number;
  total_battles: number;
  live_battles: number;
  total_tournaments: number;
};

function StatCard({ icon, label, value, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card className={`border-border/60 bg-card/30 p-4 backdrop-blur ${highlight ? "border-green-500/30 bg-green-500/5" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${highlight ? "bg-green-500/10" : "bg-muted/20"}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}

export function CommunityStats() {
  const [stats, setStats] = React.useState<Stats | null>(null);

  React.useEffect(() => {
    fetch("/api/community/stats")
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/30" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <StatCard icon={<Users className="h-4 w-4 text-blue-400" />} label="Total Players" value={stats.total_players} />
      <StatCard icon={<Swords className="h-4 w-4 text-orange-400" />} label="Total Battles" value={stats.total_battles} />
      <StatCard icon={<Zap className="h-4 w-4 text-green-400" />} label="Live Now" value={stats.live_battles} highlight={stats.live_battles > 0} />
      <StatCard icon={<Trophy className="h-4 w-4 text-yellow-400" />} label="Tournaments" value={stats.total_tournaments} />
    </div>
  );
}
