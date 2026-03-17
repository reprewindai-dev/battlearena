"use client";

import * as React from "react";
import { BattleAnalytics } from "@/components/analytics/BattleAnalytics";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AnalyticsData = {
  totalBattles: number;
  winRate: number;
  avgViewers: number;
  avgEngagement: number;
  avgAudioQuality: number;
  avgVideoQuality: number;
  totalEarnings: number;
  monthlyGrowth: number;
  recentBattles: Array<{
    id: string;
    opponent: string;
    result: "win" | "loss" | "tie";
    viewers: number;
    engagement: number;
    earnings: number;
    date: string;
  }>;
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  React.useEffect(() => {
    async function fetchAnalytics() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Authentication required");
          return;
        }

        const response = await fetch("/api/analytics", {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        });

        if (response.status === 403) {
          setError("Analytics requires a Pro subscription");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch analytics");
        }

        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Analytics Unavailable</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          {error.includes("Pro subscription") && (
            <a href="/billing" className="text-primary hover:underline">
              Upgrade to Pro Plan
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">No Analytics Data</h2>
          <p className="text-muted-foreground">Start battling to see your analytics here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Track your battle performance and earnings</p>
      </div>

      <BattleAnalytics analytics={analytics} />
    </div>
  );
}
