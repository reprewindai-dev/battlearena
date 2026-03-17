"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Users, Swords } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SearchResult = {
  id: string;
  handle?: string;
  display_name?: string | null;
  elo_rating?: number;
  tier?: string;
  is_verified?: boolean;
  status?: string;
  mode?: string;
  created_at?: string;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [type, setType] = React.useState<"users" | "battles">("users");
  const [loading, setLoading] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const router = useRouter();
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&type=${type}&limit=6`)
      .then(r => r.json())
      .then(d => setResults(d.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, type]);

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showDropdown = focused && (results.length > 0 || loading) && query.length >= 2;

  return (
    <div className={`relative ${compact ? "w-48" : "w-full max-w-md"}`} ref={wrapperRef}>
      <div className="flex">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 pr-3"
            placeholder={compact ? "Search…" : "Search players, battles…"}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={e => {
              if (e.key === "Enter" && query) {
                router.push(`/app/search?q=${encodeURIComponent(query)}&type=${type}`);
                setFocused(false);
              }
            }}
          />
        </div>
        {!compact && (
          <div className="ml-1 flex">
            <Button
              variant={type === "users" ? "default" : "outline"}
              size="sm"
              onClick={() => setType("users")}
              className="rounded-r-none"
            >
              <Users className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={type === "battles" ? "default" : "outline"}
              size="sm"
              onClick={() => setType("battles")}
              className="rounded-l-none"
            >
              <Swords className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border/60 bg-background shadow-2xl">
          {loading ? (
            <div className="p-3 text-center text-sm text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">No results</div>
          ) : (
            <div className="py-1">
              {results.map(r => (
                type === "users" ? (
                  <Link
                    key={r.id}
                    href={`/app/players/${r.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
                    onClick={() => { setFocused(false); setQuery(""); }}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/30 text-xs font-bold">
                      {(r.display_name ?? r.handle ?? "?")[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{r.display_name ?? r.handle}</div>
                      <div className="text-xs text-muted-foreground">
                        @{r.handle} · {r.elo_rating} ELO · {r.tier?.toUpperCase()}
                        {r.is_verified && " ✓"}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <Link
                    key={r.id}
                    href={`/app/battles/room?battleId=${r.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
                    onClick={() => { setFocused(false); setQuery(""); }}
                  >
                    <Swords className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{r.id}</div>
                      <div className="text-xs text-muted-foreground">{r.mode} · {r.status}</div>
                    </div>
                  </Link>
                )
              ))}
              {results.length === 6 && (
                <Link
                  href={`/app/search?q=${encodeURIComponent(query)}&type=${type}`}
                  className="block px-4 py-2 text-center text-xs text-muted-foreground hover:bg-muted/20"
                  onClick={() => setFocused(false)}
                >
                  View all results →
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
