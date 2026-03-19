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
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BattleArenaLogo size="small" />
            <BattleArenaWordmark size="small" />
          </div>
          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <header className="hidden lg:block fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BattleArenaLogo size="medium" />
              <BattleArenaWordmark size="medium" />
            </div>

            <nav className="hidden lg:flex items-center gap-6">
              {appNavigation.map(({ href, label, icon: Icon }) => (
                <Button key={href} asChild variant="ghost" className="text-white hover:bg-white/10 flex items-center gap-2">
                  <Link href={href}>
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                </Button>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <Button asChild className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600">
                <Link href="/app/battles">Start Battle</Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-full p-0 h-auto">
                <Link href="/app/profile" aria-label="Open profile">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/95 backdrop-blur-lg">
          <div className="flex flex-col h-full pt-20 px-6 pb-6">
            <nav className="flex flex-col gap-4">
              {[
                ...appNavigation,
                { href: "/app/profile", label: "Profile", icon: User },
              ].map(({ href, label, icon: Icon }) => (
                <Button
                  key={href}
                  asChild
                  variant="ghost"
                  className="text-white hover:bg-white/10 justify-start"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href={href}>
                    <Icon className="w-4 h-4 mr-3" />
                    {label}
                  </Link>
                </Button>
              ))}
            </nav>

            <div className="mt-auto">
              <Button asChild className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600">
                <Link href="/app/battles">Start Battle</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="lg:pt-20">{children}</main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg border-t border-white/10 z-40">
        <div className="flex items-center justify-around py-2">
          {[...appNavigation, { href: "/app/profile", label: "Profile", icon: User }].map(
            ({ href, label, icon: Icon }) => (
              <Button key={href} asChild variant="ghost" className="text-white hover:bg-white/10 flex flex-col gap-1 p-2">
                <Link href={href}>
                  <Icon className="w-5 h-5" />
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
        fetch("/api/beats?limit=8&sort_by=usage_count&sort_order=desc"),
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
      icon: <Zap className="w-6 h-6 text-orange-400" />,
      value: stats.activeBattles,
      label: "Active Battles",
      classes: "from-orange-900/20 to-orange-800/20 border-orange-500/20 text-orange-400",
    },
    {
      icon: <Mic className="w-6 h-6 text-purple-400" />,
      value: stats.beatsInLibrary,
      label: "Beats",
      classes: "from-purple-900/20 to-purple-800/20 border-purple-500/20 text-purple-400",
    },
    {
      icon: <Users className="w-6 h-6 text-pink-400" />,
      value: stats.activeBattlers,
      label: "Battlers",
      classes: "from-pink-900/20 to-pink-800/20 border-pink-500/20 text-pink-400",
    },
    {
      icon: <Trophy className="w-6 h-6 text-yellow-400" />,
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

      <section className="container mx-auto px-4 lg:px-6 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className={`bg-gradient-to-br ${stat.classes}`}>
              <CardContent className="p-4 lg:p-6 text-center">
                <div className="flex items-center justify-center mb-2">{stat.icon}</div>
                <div className={`text-2xl lg:text-3xl font-bold ${stat.classes.split(" ").at(-1)}`}>{stat.value}</div>
                <div className="text-white/60 text-sm">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 lg:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-white">
            Featured <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">Battles</span>
          </h2>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <Link href="/app/battles">View All</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {featuredBattles.length === 0 ? (
            <Card className="col-span-full bg-gradient-to-br from-purple-900/20 to-orange-900/20 border-white/10">
              <CardContent className="p-6 text-white/70">
                No live or queued battles are available right now.
              </CardContent>
            </Card>
          ) : (
            featuredBattles.map((battle) => (
              <Card key={battle.id} className="bg-gradient-to-br from-purple-900/20 to-orange-900/20 border-white/10 hover:border-white/20 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Badge className={battle.status === "active" ? "bg-orange-500 text-white" : "bg-slate-700 text-white"}>
                      {battle.status.toUpperCase()}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 text-sm font-bold">{battle.battle_type.toUpperCase()}</span>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">{battle.title}</h3>

                  <div className="flex items-center justify-between mb-4 text-sm text-white/70">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{battle.format}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{battle.viewers} watching</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/60 text-sm">Entry</span>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400 text-sm font-bold">{battle.entry_fee_tokens}</span>
                      <span className="text-white/60 text-sm">tokens</span>
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

      <section className="container mx-auto px-4 lg:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-white">
            Trending <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Beats</span>
          </h2>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <Link href="/app/beats">Browse All</Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {trendingBeats.length === 0 ? (
            <Card className="col-span-full bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-white/10">
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
                <Card className="w-full bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-white/10 hover:border-white/20 transition-all cursor-pointer text-left">
                  <CardContent className="p-4">
                    <div className="w-full h-24 bg-gradient-to-br from-orange-400 to-pink-400 rounded-lg mb-3 flex items-center justify-center">
                      <Mic className="w-8 h-8 text-white/80" />
                    </div>
                    <h4 className="text-white font-bold text-sm mb-1">{beat.title}</h4>
                    <p className="text-white/60 text-xs mb-2">{beat.artist}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-orange-400 text-xs font-bold">{beat.tempo} BPM</span>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-400" />
                        <span className="text-green-400 text-xs">{beat.usage_count} uses</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Button>
            ))
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 lg:px-6 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-900/40 via-purple-900/40 to-pink-900/40 p-8 lg:p-12">
          <div className="relative z-10 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Ready to <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">DOMINATE</span> the Arena?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
              Join the live battle network, queue for real matchups, and enter the arena with real beats.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 px-8 py-3 text-lg">
                <Link href="/app/battles">Start Your First Battle</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10 px-8 py-3 text-lg">
                <Link href="/app/battles/room">Watch Live Battles</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PremiumLayout>
  );
};
