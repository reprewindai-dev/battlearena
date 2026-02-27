"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, TrendingUp, Shield } from "lucide-react";

type LeaderboardEntry = {
  rank: number;
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  elo_rating: number;
  wins: number;
  losses: number;
  total_battles: number;
  tier: string;
  is_verified: boolean;
  win_rate: number;
};

const TIER_COLORS: Record<string, string> = {
  bronze: "text-amber-600",
  silver: "text-slate-400",
  gold: "text-yellow-400",
  platinum: "text-cyan-400",
  diamond: "text-blue-400",
  legend: "text-purple-400",
};

const TIER_ICONS: Record<string, React.ReactNode> = {
  legend: <Crown className="h-3.5 w-3.5 text-purple-400" />,
  diamond: <Shield className="h-3.5 w-3.5 text-blue-400" />,
  platinum: <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />,
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>;
  if (rank === 2) return <span className="text-lg">🥈</span>;
  if (rank === 3) return <span className="text-lg">🥉</span>;
  return <span className="w-6 text-center text-sm font-mono text-muted-foreground">{rank}</span>;
}

export function Leaderboard() {
  const [entries, setEntries] = React.useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tier, setTier] = React.useState("all");
  const [period, setPeriod] = React.useState("all");

  React.useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50", period });
    if (tier !== "all") params.set("tier", tier);

    fetch(`/api/community/leaderboard?${params}`)
      .then(r => r.json())
      .then(d => setEntries(d.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [tier, period]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <div className="flex items-center gap-2">
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="legend">Legend</SelectItem>
              <SelectItem value="diamond">Diamond</SelectItem>
              <SelectItem value="platinum">Platinum</SelectItem>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
              <SelectItem value="bronze">Bronze</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/30" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card className="border-border/60 bg-card/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">No players ranked yet. Start battling!</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 bg-muted/20 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">ELO</span>
            <span className="text-right">W/L</span>
            <span className="text-right">WR%</span>
          </div>
          <div className="divide-y divide-border/40">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-card/40 ${entry.rank <= 3 ? "bg-card/20" : ""}`}
              >
                <RankBadge rank={entry.rank} />
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/30 text-sm font-bold">
                    {entry.display_name?.[0] ?? entry.handle[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <Link href={`/app/players/${entry.id}`} className="truncate text-sm font-medium hover:underline">
                        {entry.display_name ?? entry.handle}
                      </Link>
                      {TIER_ICONS[entry.tier]}
                      {entry.is_verified && <span className="text-xs text-blue-400">✓</span>}
                    </div>
                    <span className={`text-xs ${TIER_COLORS[entry.tier] ?? "text-muted-foreground"}`}>
                      {entry.tier.toUpperCase()}
                    </span>
                  </div>
                </div>
                <span className="text-right font-mono text-sm font-semibold">{entry.elo_rating}</span>
                <span className="text-right text-xs text-muted-foreground">
                  {entry.wins}W / {entry.losses}L
                </span>
                <span className="text-right text-xs font-medium text-green-400">
                  {entry.win_rate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
