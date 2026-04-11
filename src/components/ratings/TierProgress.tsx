"use client";

import * as React from "react";
import { Crown, Shield, TrendingUp, Star } from "lucide-react";
import { getTierInfo } from "@/lib/ratings/glicko2";

const TIER_ICONS: Record<string, React.ReactNode> = {
  legend: <Crown className="h-4 w-4 text-purple-400" />,
  diamond: <Shield className="h-4 w-4 text-blue-400" />,
  platinum: <TrendingUp className="h-4 w-4 text-cyan-400" />,
  gold: <Star className="h-4 w-4 text-yellow-400" />,
  silver: <Star className="h-4 w-4 text-slate-400" />,
  bronze: <Star className="h-4 w-4 text-amber-600" />,
};

const TIER_BG: Record<string, string> = {
  legend: "from-purple-500/20 to-purple-500/5 border-purple-500/30",
  diamond: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  platinum: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
  gold: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30",
  silver: "from-slate-400/20 to-slate-400/5 border-slate-400/30",
  bronze: "from-amber-600/20 to-amber-600/5 border-amber-600/30",
};

interface TierProgressProps {
  rating: number;
  wins?: number;
  losses?: number;
}

export function TierProgress({ rating, wins = 0, losses = 0 }: TierProgressProps) {
  const info = getTierInfo(rating);
  const totalBattles = wins + losses;
  const winRate = totalBattles > 0 ? ((wins / totalBattles) * 100).toFixed(1) : "0.0";

  // Progress within current tier
  const tierRange = info.maxRating - info.minRating;
  const tierProgress = tierRange > 0 && tierRange < 9000
    ? Math.min(100, ((rating - info.minRating) / tierRange) * 100)
    : 100;

  return (
    <div className={`rounded-lg border bg-gradient-to-br p-4 ${TIER_BG[info.tier] ?? TIER_BG.bronze}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {TIER_ICONS[info.tier] ?? TIER_ICONS.bronze}
          <div>
            <div className={`text-sm font-semibold ${info.color}`}>{info.label}</div>
            <div className="text-xs text-muted-foreground">{rating.toLocaleString()} rating</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold">{winRate}%</div>
          <div className="text-xs text-muted-foreground">Win rate</div>
        </div>
      </div>

      {info.nextTier && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress to {info.nextTier.charAt(0).toUpperCase() + info.nextTier.slice(1)}</span>
            <span>{info.pointsToNext} pts needed</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${info.color.replace("text-", "from-").replace("-400", "-500")} to-transparent`}
              style={{ width: `${tierProgress}%` }}
            />
          </div>
        </div>
      )}

      {!info.nextTier && (
        <div className="mt-2 text-xs text-muted-foreground">Maximum tier achieved</div>
      )}

      <div className="mt-3 flex gap-4 text-xs">
        <div><span className="font-semibold text-green-400">{wins}</span> <span className="text-muted-foreground">wins</span></div>
        <div><span className="font-semibold text-red-400">{losses}</span> <span className="text-muted-foreground">losses</span></div>
        <div><span className="font-semibold">{totalBattles}</span> <span className="text-muted-foreground">total</span></div>
      </div>
    </div>
  );
}
