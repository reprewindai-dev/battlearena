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
      {/* MOBILE HEADER - STREET STYLE */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b-2 border-red-500/30 bg-black/95 backdrop-blur-lg lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="graffiti-text text-xl text-white">
              BATTLE <span className="text-red-500">ARENA</span>
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded-lg bg-red-500/20 border border-red-500/30 p-2 transition-colors hover:bg-red-500/30"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5 text-red-400" /> : <Menu className="h-5 w-5 text-red-400" />}
          </button>
        </div>
      </header>

      {/* DESKTOP HEADER - STREET STYLE */}
      <header className="fixed left-0 right-0 top-0 z-50 hidden border-b-2 border-red-500/30 bg-black/95 backdrop-blur-lg lg:block">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <span className="graffiti-text text-2xl text-white">
                BATTLE <span className="text-red-500">ARENA</span>
              </span>
            </div>

            {/* Navigation */}
            <nav className="hidden items-center gap-1 lg:flex">
              {appNavigation.map(({ href, label, icon: Icon }) => (
                <Button 
                  key={href} 
                  asChild 
                  variant="ghost" 
                  className="flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/5 uppercase tracking-wider text-sm font-bold"
                >
                  <Link href={href}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                </Button>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button asChild className="btn-aggressive px-6 py-2">
                <Link href="/app/battles">ENTER ARENA</Link>
              </Button>
              <Button 
                asChild 
                variant="ghost" 
                className="h-10 w-10 rounded-full border-2 border-red-500/30 p-0 hover:border-red-500 hover:bg-red-500/10"
              >
                <Link href="/app/profile" aria-label="Open profile">
                  <User className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE MENU OVERLAY - STREET STYLE */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/98 backdrop-blur-xl lg:hidden">
          <div className="flex h-full flex-col px-6 pb-6 pt-24">
            {/* Menu Title */}
            <div className="mb-8">
              <h2 className="graffiti-text text-4xl text-white mb-2">MENU</h2>
              <div className="h-1 w-24 bg-gradient-to-r from-red-500 to-yellow-500" />
            </div>
            
            <nav className="flex flex-col gap-2">
              {[...appNavigation, { href: "/app/profile", label: "Profile", icon: User }].map(
                ({ href, label, icon: Icon }) => (
                  <Button
                    key={href}
                    asChild
                    variant="ghost"
                    className="justify-start text-white hover:text-red-400 hover:bg-red-500/10 py-4 text-lg uppercase tracking-wider font-bold"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link href={href}>
                      <Icon className="mr-4 h-6 w-6 text-red-400" />
                      {label}
                    </Link>
                  </Button>
                ),
              )}
            </nav>

            <div className="mt-auto">
              <Button 
                asChild 
                className="w-full btn-aggressive py-6 text-xl"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Link href="/app/battles">ENTER THE ARENA</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="lg:pt-20">{children}</main>

      {/* MOBILE BOTTOM NAV - TIKTOK STYLE */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-red-500/20 bg-black/95 backdrop-blur-lg lg:hidden safe-area-pb">
        <div className="flex items-center justify-around py-1">
          {[...appNavigation, { href: "/app/profile", label: "Profile", icon: User }].map(
            ({ href, label, icon: Icon }) => (
              <Button 
                key={href} 
                asChild 
                variant="ghost" 
                className="flex flex-col gap-0.5 p-2 text-white/60 hover:text-red-400 hover:bg-red-500/10"
              >
                <Link href={href}>
                  <Icon className="h-6 w-6" />
                  <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
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
      {/* AGGRESSIVE HERO SECTION */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black" />
          <div className="absolute top-0 left-0 w-full h-full opacity-20">
            <div className="absolute top-20 left-10 w-72 h-72 bg-red-600 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-green-500 rounded-full blur-[150px] animate-pulse delay-1000" />
          </div>
        </div>
        
        {/* Main hero content */}
        <div className="relative z-10 text-center px-4 max-w-6xl mx-auto">
          <div className="live-indicator mb-6 mx-auto w-fit">
            <span className="text-sm font-bold tracking-widest text-red-400">LIVE BATTLES HAPPENING NOW</span>
          </div>
          
          <h1 className="graffiti-title mb-4" data-text="BATTLE ARENA">
            BATTLE ARENA
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-2 font-bold tracking-wide">
            STEP INTO THE RING
          </p>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Real freestyle rap battles. Real beats. Real competition. 
            Prove you got bars or get eaten alive.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              asChild 
              className="btn-aggressive px-8 py-6 text-xl"
            >
              <Link href="/app/battles">ENTER THE ARENA</Link>
            </Button>
            <Button 
              asChild 
              variant="outline" 
              className="neon-border-green px-8 py-6 text-xl bg-transparent hover:bg-green-500/10"
            >
              <Link href="/app/beats">BROWSE BEATS</Link>
            </Button>
          </div>
          
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-12 max-w-lg mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-500 neon-red">{stats.activeBattles}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">Active</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500 neon-green">{stats.beatsInLibrary}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">Beats</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-500 neon-yellow">{stats.activeBattlers}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">Battlers</div>
            </div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-white/60 rounded-full" />
          </div>
        </div>
      </section>

      {/* TIKTOK-STYLE BATTLE FEED */}
      <section className="container mx-auto px-4 py-12 lg:px-6">
        <div className="mb-8">
          <h2 className="graffiti-text text-4xl md:text-5xl mb-2">
            <span className="text-red-500">LIVE</span> BATTLES
          </h2>
          <p className="text-gray-400">Jump in or watch the carnage unfold</p>
        </div>

        {/* AGGRESSIVE BATTLE CARDS GRID */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featuredBattles.length === 0 ? (
            <div className="col-span-full battle-card p-8 text-center">
              <p className="text-gray-400 text-lg">THE ARENA IS QUIET...</p>
              <p className="text-gray-500 text-sm mt-2">Be the first to start a battle</p>
              <Button asChild className="btn-aggressive mt-6">
                <Link href="/app/battles">START BATTLE</Link>
              </Button>
            </div>
          ) : (
            featuredBattles.map((battle) => (
              <div
                key={battle.id}
                className="battle-card group cursor-pointer"
                onClick={() => router.push(`/app/battles/room?battleId=${encodeURIComponent(battle.id)}`)}
              >
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          battle.battle_type === "ranked"
                            ? "bg-red-500/20 text-red-400 border-red-500 neon-border"
                            : battle.battle_type === "tournament"
                              ? "bg-purple-500/20 text-purple-400 border-purple-500"
                              : "bg-green-500/20 text-green-400 border-green-500 neon-border-green"
                        }
                      >
                        {battle.battle_type.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-gray-500 font-mono">{battle.format}</span>
                    </div>
                    {battle.status === "active" && (
                      <div className="live-indicator">
                        <span className="text-xs font-bold">LIVE</span>
                      </div>
                    )}
                  </div>

                  {/* VS Section */}
                  <div className="flex items-center justify-center gap-4 my-6">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-2xl font-bold">
                        ?
                      </div>
                      <p className="text-xs text-gray-500 mt-2">WAITING</p>
                    </div>
                    <div className="vs-text">VS</div>
                    <div className="text-center">
                      <div className="w-16 h-16 rounded bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-2xl font-bold">
                        ?
                      </div>
                      <p className="text-xs text-gray-500 mt-2">WAITING</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                    <span className="text-sm text-gray-400">{battle.viewers} watching</span>
                    <Button 
                      className="btn-aggressive text-sm px-4 py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/app/battles/room?battleId=${encodeURIComponent(battle.id)}`);
                      }}
                    >
                      {battle.status === "active" ? "WATCH" : "JOIN"}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* TRENDING BEATS - STREET STYLE */}
      <section className="container mx-auto px-4 py-12 lg:px-6">
        <div className="mb-8">
          <h2 className="graffiti-text text-4xl md:text-5xl mb-2">
            <span className="text-yellow-500">HOT</span> BEATS
          </h2>
          <p className="text-gray-400">Fire instrumentals waiting for your bars</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {trendingBeats.length === 0 ? (
            <div className="col-span-full battle-card p-8 text-center">
              <p className="text-gray-400 text-lg">NO BEATS LOADED</p>
              <p className="text-gray-500 text-sm mt-2">Check back later for fresh drops</p>
            </div>
          ) : (
            trendingBeats.map((beat) => (
              <div
                key={beat.id}
                className="battle-card cursor-pointer group"
                onClick={() => router.push("/app/beats")}
              >
                <div className="p-4">
                  {/* Visualizer placeholder */}
                  <div className="mb-4 h-24 w-full bg-gradient-to-t from-gray-800 to-gray-700 flex items-end justify-center gap-1 pb-2 rounded overflow-hidden">
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className="w-2 bg-gradient-to-t from-green-500 to-yellow-400 rounded-t"
                        style={{
                          height: `${20 + Math.random() * 60}%`,
                          animation: `pulse ${0.5 + Math.random() * 0.5}s ease-in-out infinite`,
                        }}
                      />
                    ))}
                  </div>
                  
                  <h4 className="text-sm font-bold text-white truncate">{beat.title}</h4>
                  <p className="text-xs text-gray-500 mb-2">{beat.artist}</p>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-400 font-mono">{beat.tempo} BPM</span>
                    <span className="text-yellow-400">{beat.usage_count} USES</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="graffiti-text text-5xl md:text-7xl mb-4">
          YOU <span className="text-red-500">READY</span>?
        </h2>
        <p className="text-gray-400 mb-8 max-w-xl mx-auto">
          The mic is waiting. The crowd is watching. Step up or step aside.
        </p>
        <Button 
          asChild 
          className="btn-aggressive px-12 py-8 text-2xl"
        >
          <Link href="/app/battles">ENTER THE ARENA</Link>
        </Button>
      </section>
    </PremiumLayout>
  );
};
