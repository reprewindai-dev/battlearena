"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, Eye, Mic, Video } from "lucide-react";

type BattleAnalytics = {
  totalBattles: number;
  winRate: number;
  avgViewers: number;
  avgEngagement: number;
  avgAudioQuality: number;
  avgVideoQuality: number;
  totalEarningsTokens: number;
  monthlyGrowth: number;
  recentBattles: Array<{
    id: string;
    opponent: string;
    result: "win" | "loss" | "tie";
    viewers: number;
    engagement: number;
    earningsTokens: number;
    date: string;
  }>;
};

export function BattleAnalytics({ analytics }: { analytics: BattleAnalytics }) {
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatTokens = (value: number) => `${value.toLocaleString()} tokens`;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(analytics.winRate)}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.monthlyGrowth > 0 ? "+" : ""}{formatPercent(analytics.monthlyGrowth)} from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Viewers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.avgViewers}</div>
            <p className="text-xs text-muted-foreground">Per battle</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(analytics.avgEngagement)}</div>
            <p className="text-xs text-muted-foreground">Average engagement rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(analytics.totalEarningsTokens)}</div>
            <p className="text-xs text-muted-foreground">Battle winnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Quality Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Stream Quality
          </CardTitle>
          <CardDescription>Average quality scores across all battles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                <span className="text-sm font-medium">Video Quality</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatPercent(analytics.avgVideoQuality)}
              </span>
            </div>
            <Progress value={analytics.avgVideoQuality * 100} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                <span className="text-sm font-medium">Audio Quality</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatPercent(analytics.avgAudioQuality)}
              </span>
            </div>
            <Progress value={analytics.avgAudioQuality * 100} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Recent Battles */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Battles</CardTitle>
          <CardDescription>Your last 10 battle performances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.recentBattles.map((battle) => (
              <div key={battle.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Badge variant={battle.result === "win" ? "default" : battle.result === "tie" ? "secondary" : "destructive"}>
                    {battle.result.toUpperCase()}
                  </Badge>
                  <div>
                    <p className="font-medium">vs {battle.opponent}</p>
                    <p className="text-sm text-muted-foreground">{new Date(battle.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatTokens(battle.earningsTokens)}</p>
                  <p className="text-sm text-muted-foreground">{battle.viewers} viewers</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
