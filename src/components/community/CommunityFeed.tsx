"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Swords, Star, Users, Zap, TrendingUp } from "lucide-react";

type FeedActor = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: string;
  is_verified: boolean;
  elo_rating: number;
};

type FeedItem = {
  id: string;
  type: string;
  subject_id: string | null;
  subject_type: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  actor: FeedActor;
};

const FEED_ICONS: Record<string, React.ReactNode> = {
  battle_win: <Trophy className="h-4 w-4 text-yellow-400" />,
  battle_complete: <Swords className="h-4 w-4 text-blue-400" />,
  achievement_earned: <Star className="h-4 w-4 text-purple-400" />,
  joined_tournament: <Users className="h-4 w-4 text-green-400" />,
  challenge_issued: <Zap className="h-4 w-4 text-orange-400" />,
  rank_up: <TrendingUp className="h-4 w-4 text-pink-400" />,
  first_battle: <Swords className="h-4 w-4 text-cyan-400" />,
};

function feedLabel(item: FeedItem): string {
  const handle = item.actor.handle;
  switch (item.type) {
    case "battle_win":
      return `${handle} won a battle`;
    case "battle_complete":
      return `${handle} completed a battle`;
    case "achievement_earned":
      return `${handle} earned "${item.meta.label ?? "an achievement"}"`;
    case "joined_tournament":
      return `${handle} joined ${item.meta.tournament_name ?? "a tournament"}`;
    case "challenge_issued":
      return `${handle} issued a challenge`;
    case "rank_up":
      return `${handle} ranked up to ${item.meta.tier ?? "a new tier"}`;
    case "first_battle":
      return `${handle} fought their first battle`;
    default:
      return `${handle} did something`;
  }
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    bronze: "bg-amber-800/30 text-amber-400 border-amber-600/40",
    silver: "bg-slate-400/20 text-slate-300 border-slate-400/40",
    gold: "bg-yellow-400/20 text-yellow-300 border-yellow-400/40",
    platinum: "bg-cyan-400/20 text-cyan-300 border-cyan-400/40",
    diamond: "bg-blue-400/20 text-blue-300 border-blue-500/40",
    legend: "bg-purple-400/20 text-purple-300 border-purple-500/40",
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${colors[tier] ?? colors.bronze}`}>
      {tier}
    </span>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const icon = FEED_ICONS[item.type] ?? <Swords className="h-4 w-4 text-muted-foreground" />;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/30 px-4 py-3 backdrop-blur transition-colors hover:bg-card/50">
      <div className="mt-0.5 shrink-0 rounded-full border border-border/60 bg-background/40 p-2">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <Link href={`/app/players/${item.actor.id}`} className="font-medium hover:underline">
            {item.actor.display_name ?? item.actor.handle}
          </Link>
          <TierBadge tier={item.actor.tier} />
          {item.actor.is_verified && (
            <span className="text-blue-400" title="Verified">✓</span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{feedLabel(item)}</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          {formatDistanceToNow(item.created_at)}
        </p>
      </div>
      {item.subject_type === "battle" && item.subject_id && (
        <Button asChild size="sm" variant="outline" className="shrink-0 self-center">
          <Link href={`/app/battles/room?battleId=${item.subject_id}`}>Watch</Link>
        </Button>
      )}
    </div>
  );
}

export function CommunityFeed() {
  const [items, setItems] = React.useState<FeedItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"global" | "following">("global");
  const [hasMore, setHasMore] = React.useState(true);
  const [offset, setOffset] = React.useState(0);

  const fetchFeed = React.useCallback(async (filterVal: string, offsetVal: number, append = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/community/feed?filter=${filterVal}&offset=${offsetVal}&limit=20`);
      if (!res.ok) throw new Error("Failed to load feed");
      const json = await res.json();
      const newItems: FeedItem[] = json.items ?? [];
      setItems(prev => append ? [...prev, ...newItems] : newItems);
      setHasMore(newItems.length === 20);
    } catch {
      // swallow
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setOffset(0);
    fetchFeed(filter, 0, false);
  }, [filter, fetchFeed]);

  function loadMore() {
    const next = offset + 20;
    setOffset(next);
    fetchFeed(filter, next, true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Community Feed</h2>
        <Tabs value={filter} onValueChange={v => setFilter(v as "global" | "following")}>
          <TabsList className="h-8">
            <TabsTrigger value="global" className="text-xs">Global</TabsTrigger>
            <TabsTrigger value="following" className="text-xs">Following</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading && items.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/30" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-border/60 bg-card/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "following"
              ? "Follow some players to see their activity here."
              : "No activity yet. Be the first to battle!"}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <FeedCard key={item.id} item={item} />
          ))}
          {hasMore && (
            <Button
              onClick={loadMore}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
