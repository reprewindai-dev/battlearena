"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchBar } from "@/components/community/SearchBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Swords, TrendingUp } from "lucide-react";

type SearchResult = {
  id: string;
  handle?: string;
  display_name?: string | null;
  elo_rating?: number;
  tier?: string;
  is_verified?: boolean;
  wins?: number;
  losses?: number;
  total_battles?: number;
  status?: string;
  mode?: string;
  created_at?: string;
};

const TIER_COLORS: Record<string, string> = {
  bronze: "text-amber-600",
  silver: "text-slate-400",
  gold: "text-yellow-400",
  platinum: "text-cyan-400",
  diamond: "text-blue-400",
  legend: "text-purple-400",
};

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";
  const initialType = (searchParams.get("type") ?? "users") as "users" | "battles";

  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [type, setType] = React.useState(initialType);
  const [query, setQuery] = React.useState(initialQ);

  React.useEffect(() => {
    if (!query || query.length < 2) return;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}&limit=20`)
      .then(r => r.json())
      .then(d => setResults(d.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [query, type]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find players and battles.</p>
      </div>

      <div className="flex gap-3">
        <SearchBar compact={false} />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={type === "users" ? "default" : "outline"}
          onClick={() => setType("users")}
        >
          <Users className="mr-1.5 h-3.5 w-3.5" />
          Players
        </Button>
        <Button
          size="sm"
          variant={type === "battles" ? "default" : "outline"}
          onClick={() => setType("battles")}
        >
          <Swords className="mr-1.5 h-3.5 w-3.5" />
          Battles
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/30" />
          ))}
        </div>
      ) : results.length === 0 && query.length >= 2 ? (
        <Card className="border-border/60 bg-card/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">No results for "{query}"</p>
        </Card>
      ) : type === "users" ? (
        <div className="space-y-2">
          {results.map(r => (
            <Link key={r.id} href={`/app/players/${r.id}`}>
              <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/30 px-4 py-3 transition-colors hover:bg-card/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/30 text-sm font-bold">
                  {(r.display_name ?? r.handle ?? "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{r.display_name ?? r.handle}</span>
                    {r.is_verified && <span className="text-xs text-blue-400">✓</span>}
                    {r.tier && (
                      <span className={`text-xs font-medium uppercase ${TIER_COLORS[r.tier] ?? ""}`}>
                        {r.tier}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    @{r.handle} · {r.wins ?? 0}W {r.losses ?? 0}L · {r.elo_rating} ELO
                  </div>
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map(r => (
            <Link key={r.id} href={`/app/battles/room?battleId=${r.id}`}>
              <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/30 px-4 py-3 transition-colors hover:bg-card/50">
                <div className="rounded-full border border-border/60 bg-background/40 p-2">
                  <Swords className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm">{r.id}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.mode} · {r.status} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">{r.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
