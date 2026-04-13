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
    <Card className={`spitzone-panel p-4 ${highlight ? "border-primary/25 bg-primary/8" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-xl border p-2 ${highlight ? "border-primary/20 bg-primary/12" : "border-white/10 bg-black/20"}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums text-white">{value.toLocaleString()}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/44">{label}</div>
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
          <div key={i} className="h-20 animate-pulse rounded-[1.2rem] border border-white/10 bg-black/20" />
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
