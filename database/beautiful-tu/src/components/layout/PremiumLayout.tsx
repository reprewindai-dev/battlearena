"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import {
  Clock,
  Home,
  Menu,
  Mic,
  Swords,
  TrendingUp,
  Trophy,
  User,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";

import { HeroBanner } from "@/components/brand/Banner";
import { BattleArenaLogo, BattleArenaWordmark } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface LayoutProps {
  children: React.ReactNode;
}

type HomeBattle = {
  id: string;
  title: string;
  battle_type: "ranked" | "casual" | "tournament";
  format: "30s" | "60s" | "90s";
  entry_fee_tokens: number;
  status: "waiting" | "active" | "completed";
  viewers: number;
};

type HomeBeat = {
  id: string;
  title: string;
  artist: string;
  tempo: number;
  usage_count: number;
};

type LeaderboardEntry = {
  id: string;
  elo_rating?: number;
};

const appNavigation = [
  { href: "/", label: "Home", icon: Home },
  { href: "/app/battles", label: "Battles", icon: Swords },
  { href: "/app/beats", label: "Beats", icon: Mic },
  { href: "/app/tournaments", label: "Tournaments", icon: Trophy },
];

export const PremiumLayout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-lg lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BattleArenaLogo size="small" />
            <BattleArenaWordmark size="small" />
          </div>
          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <header className="fixed left-0 right-0 top-0 z-50 hidden border-b border-white/10 bg-black/90 backdrop-blur-lg lg:block">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BattleArenaLogo size="medium" />
              <BattleArenaWordmark size="medium" />
            </div>

            <nav className="hidden items-center gap-6 lg:flex">
              {appNavigation.map(({ href, label, icon: Icon }) => (
                <Button key={href} asChild variant="ghost" className="flex items-center gap-2 text-white hover:bg-white/10">
                  <Link href={href}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                </Button>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <Button asChild className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600">
                <Link href="/app/battles">Enter Battle</Link>
              </Button>
              <Button asChild variant="ghost" className="h-auto rounded-full p-0">
                <Link href="/app/profile" aria-label="Open profile">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/95 backdrop-blur-lg lg:hidden">
          <div className="flex h-full flex-col px-6 pb-6 pt-20">
            <nav className="flex flex-col gap-4">
              {[...appNavigation, { href: "/app/profile", label: "Profile", icon: User }].map(
                ({ href, label, icon: Icon }) => (
                  <Button
                    key={href}
                    asChild
                    variant="ghost"
                    className="justify-start text-white hover:bg-white/10"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link href={href}>
                      <Icon className="mr-3 h-4 w-4" />
                      {label}
                    </Link>
                  </Button>
                ),
              )}
            </nav>

            <div className="mt-auto">
              <Button asChild className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600">
                <Link href="/app/battles">Enter Battle</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="lg:pt-20">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/90 backdrop-blur-lg lg:hidden">
        <div className="flex items-center justify-around py-2">
          {[...appNavigation, { href: "/app/profile", label: "Profile", icon: User }].map(
            ({ href, label, icon: Icon }) => (
              <Button key={href} asChild variant="ghost" className="flex flex-col gap-1 p-2 text-white hover:bg-white/10">
                <Link href={href}>
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{label}</span>
                </Link>
              </Button>
            ),
          )}
        </div>
      </nav>
    </div>
  );
};

export const PremiumHomePage: React.FC = () => {
  const router = useRouter();
  const [featuredBattles, setFeaturedBattles] = React.useState<HomeBattle[]>([]);
  const [trendingBeats, setTrendingBeats] = React.useState<HomeBeat[]>([]);
  const [stats, setStats] = React.useState({
    activeBattles: 0,
    beatsInLibrary: 0,
    activeBattlers: 0,
    topRating: 0,
  });

  React.useEffect(() => {
    let cancelled = false;

    async function loadHomeData() {
      const [battlesRes, beatsRes, leaderboardRes] = await Promise.all([
        fetch("/api/battles?limit=3"),
        fetch("/api/beats?limit=8&sort_by=usage_count&sort_order=desc&featured=true&homepage_safe=true"),
        fetch("/api/community/leaderboard?limit=25"),
      ]);

      const [battlesBody, beatsBody, leaderboardBody] = await Promise.all([
        battlesRes.json().catch(() => ({})),
        beatsRes.json().catch(() => ({})),
        leaderboardRes.json().catch(() => ({})),
      ]);

      if (cancelled) return;

      const battles = battlesRes.ok && Array.isArray(battlesBody?.battles) ? battlesBody.battles : [];
      const beats = beatsRes.ok && Array.isArray(beatsBody?.beats) ? beatsBody.beats : [];
      const entries = leaderboardRes.ok && Array.isArray(leaderboardBody?.entries)
        ? (leaderboardBody.entries as LeaderboardEntry[])
        : [];

      setFeaturedBattles(
        battles.map((battle: Record<string, unknown>) => ({
          id: String(battle.id ?? ""),
          title:
            typeof battle.title === "string" && battle.title.trim().length > 0
              ? battle.title
              : `Battle ${String(battle.id ?? "").slice(0, 8)}`,
          battle_type:
            battle.battle_type === "ranked" || battle.battle_type === "tournament"
              ? battle.battle_type
              : "casual",
          format: battle.format === "30s" || battle.format === "90s" ? battle.format : "60s",
          entry_fee_tokens: Number(battle.entry_fee_tokens ?? 0),
          status: battle.status === "active" || battle.status === "completed" ? battle.status : "waiting",
          viewers: Number(battle.viewers ?? 0),
        })),
      );

      setTrendingBeats(
        beats.map((beat: Record<string, unknown>) => ({
          id: String(beat.id ?? ""),
          title: String(beat.title ?? "Untitled Beat"),
          artist: String(beat.artist ?? "Unknown Artist"),
          tempo: Number(beat.tempo ?? 0),
          usage_count: Number(beat.usage_count ?? 0),
        })),
      );

      setStats({
        activeBattles: battles.length,
        beatsInLibrary: beats.length,
        activeBattlers: entries.length,
        topRating: entries.length > 0 ? Number(entries[0]?.elo_rating ?? 0) : 0,
      });
    }

    void loadHomeData();
    return () => {
      cancelled = true;
    };
  }, []);

  const statCards = [
    {
      icon: <Zap className="h-6 w-6 text-orange-400" />,
      value: stats.activeBattles,
      label: "Active Battles",
      classes: "from-orange-900/20 to-orange-800/20 border-orange-500/20 text-orange-400",
    },
    {
      icon: <Mic className="h-6 w-6 text-purple-400" />,
      value: stats.beatsInLibrary,
      label: "Beats",
      classes: "from-purple-900/20 to-purple-800/20 border-purple-500/20 text-purple-400",
    },
    {
      icon: <Users className="h-6 w-6 text-pink-400" />,
      value: stats.activeBattlers,
      label: "Battlers",
      classes: "from-pink-900/20 to-pink-800/20 border-pink-500/20 text-pink-400",
    },
    {
      icon: <Trophy className="h-6 w-6 text-yellow-400" />,
      value: stats.topRating,
      label: "Top ELO",
      classes: "from-yellow-900/20 to-yellow-800/20 border-yellow-500/20 text-yellow-400",
    },
  ];

  return (
    <PremiumLayout>
      <section className="relative">
        <HeroBanner />
      </section>

      <section className="container mx-auto px-4 py-8 lg:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className={`bg-gradient-to-br ${stat.classes}`}>
              <CardContent className="p-4 text-center lg:p-6">
                <div className="mb-2 flex items-center justify-center">{stat.icon}</div>
                <div className={`text-2xl font-bold lg:text-3xl ${stat.classes.split(" ").at(-1)}`}>{stat.value}</div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white lg:text-3xl">
            Featured <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">Battles</span>
          </h2>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <Link href="/app/battles">View All</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {featuredBattles.length === 0 ? (
            <Card className="col-span-full border-white/10 bg-gradient-to-br from-purple-900/20 to-orange-900/20">
              <CardContent className="p-6 text-white/70">No live or queued battles are available right now.</CardContent>
            </Card>
          ) : (
            featuredBattles.map((battle) => (
              <Card
                key={battle.id}
                className="border-white/10 bg-gradient-to-br from-purple-900/20 to-orange-900/20 transition-all hover:border-white/20"
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <Badge className={battle.status === "active" ? "bg-orange-500 text-white" : "bg-slate-700 text-white"}>
                      {battle.status.toUpperCase()}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-red-400" />
                      <span className="text-sm font-bold text-red-400">{battle.battle_type.toUpperCase()}</span>
                    </div>
                  </div>

                  <h3 className="mb-2 text-xl font-bold text-white">{battle.title}</h3>

                  <div className="mb-4 flex items-center justify-between text-sm text-white/70">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{battle.format}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{battle.viewers} watching</span>
                    </div>
                  </div>

                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm text-white/60">Entry</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-yellow-400">{battle.entry_fee_tokens}</span>
                      <span className="text-sm text-white/60">tokens</span>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                    onClick={() => router.push(`/app/battles/room?battleId=${encodeURIComponent(battle.id)}`)}
                  >
                    {battle.status === "active" ? "Watch Battle" : "Join Battle"}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white lg:text-3xl">
            Trending <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Beats</span>
          </h2>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <Link href="/app/beats">Browse All</Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {trendingBeats.length === 0 ? (
            <Card className="col-span-full border-white/10 bg-gradient-to-br from-purple-900/20 to-pink-900/20">
              <CardContent className="p-6 text-white/70">No beats are available right now.</CardContent>
            </Card>
          ) : (
            trendingBeats.map((beat) => (
              <Button
                key={beat.id}
                variant="ghost"
                className="h-auto p-0 hover:bg-transparent"
                onClick={() => router.push("/app/beats")}
              >
                <Card className="w-full cursor-pointer border-white/10 bg-gradient-to-br from-purple-900/20 to-pink-900/20 text-left transition-all hover:border-white/20">
                  <CardContent className="p-4">
                    <div className="mb-3 flex h-24 w-full items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-pink-400">
                      <Mic className="h-8 w-8 text-white/80" />
                    </div>
                    <h4 className="mb-1 text-sm font-bold text-white">{beat.title}</h4>
                    <p className="mb-2 text-xs text-white/60">{beat.artist}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-orange-400">{beat.tempo} BPM</span>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-400" />
                        <span className="text-xs text-green-400">{beat.usage_count} uses</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Button>
            ))
          )}
        </div>
      </section>
    </PremiumLayout>
  );
};
