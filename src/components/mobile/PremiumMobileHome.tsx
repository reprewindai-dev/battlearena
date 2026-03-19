import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  PremiumMobileLayout, 
  MobileBattleCard, 
  MobileBeatCard, 
  MobileStatsCard,
  MobileSearchBar 
} from '@/components/mobile/PremiumMobileComponents';
import { HeroBanner } from '@/components/brand/Banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Swords, 
  Mic, 
  Trophy, 
  Users, 
  TrendingUp, 
  Zap, 
  Clock, 
  Video, 
  Play, 
  Heart, 
  Share2, 
  Filter,
  Search,
  Star,
  Crown,
  Flame
} from 'lucide-react';

const PremiumMobileHomePage: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [likedBattles, setLikedBattles] = useState<Set<string>>(new Set());
  const [likedBeats, setLikedBeats] = useState<Set<string>>(new Set());
  const [featuredBattles, setFeaturedBattles] = useState<Array<{
    id: string;
    title: string;
    room_code: string;
    battle_type: 'ranked' | 'casual' | 'tournament';
    format: '30s' | '60s' | '90s';
    entry_fee_tokens: number;
    status: 'waiting' | 'active' | 'completed';
    current_participants: number;
    max_participants: number;
    viewers: number;
  }>>([]);
  const [trendingBeats, setTrendingBeats] = useState<Array<{
    id: string;
    title: string;
    artist: string;
    tempo: number;
    genre: string;
    duration_seconds: number;
    preview_url: string;
    usage_count: number;
  }>>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<Array<{
    id: string;
    rank: number;
    handle?: string | null;
    display_name?: string | null;
    wins?: number;
    elo_rating?: number;
  }>>([]);
  const [homeStats, setHomeStats] = useState({
    activeBattles: 0,
    beatsInLibrary: 0,
    activeBattlers: 0,
    topRating: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadHomeData() {
      const [battlesRes, beatsRes, leaderboardRes] = await Promise.all([
        fetch('/api/battles?limit=6'),
        fetch('/api/beats?limit=8&sort_by=usage_count&sort_order=desc'),
        fetch('/api/community/leaderboard?limit=3'),
      ]);

      const [battlesBody, beatsBody, leaderboardBody] = await Promise.all([
        battlesRes.json().catch(() => ({})),
        beatsRes.json().catch(() => ({})),
        leaderboardRes.json().catch(() => ({})),
      ]);

      if (cancelled) return;

      const battles = battlesRes.ok && Array.isArray(battlesBody?.battles) ? battlesBody.battles : [];
      const beats = beatsRes.ok && Array.isArray(beatsBody?.beats) ? beatsBody.beats : [];
      const entries = leaderboardRes.ok && Array.isArray(leaderboardBody?.entries) ? leaderboardBody.entries : [];

      setFeaturedBattles(
        battles.map((battle: any) => ({
          id: String(battle.id),
          title: typeof battle.title === 'string' ? battle.title : `Battle ${String(battle.room_code ?? '').slice(0, 6)}`,
          room_code: String(battle.room_code ?? '').slice(0, 10),
          battle_type: battle.battle_type === 'ranked' || battle.battle_type === 'tournament' ? battle.battle_type : 'casual',
          format: battle.format === '30s' || battle.format === '90s' ? battle.format : '60s',
          entry_fee_tokens: Number(battle.entry_fee_tokens ?? 0),
          status: battle.status === 'active' || battle.status === 'completed' ? battle.status : 'waiting',
          current_participants: Number(battle.current_participants ?? 0),
          max_participants: Number(battle.max_participants ?? 2),
          viewers: Number(battle.viewers ?? 0),
        })),
      );

      setTrendingBeats(
        beats.map((beat: any) => ({
          id: String(beat.id),
          title: String(beat.title ?? 'Untitled Beat'),
          artist: String(beat.artist ?? 'Unknown Artist'),
          tempo: Number(beat.tempo ?? 0),
          genre: String(beat.genre ?? 'unknown'),
          duration_seconds: Number(beat.duration_seconds ?? 0),
          preview_url: String(beat.preview_url ?? ''),
          usage_count: Number(beat.usage_count ?? 0),
        })),
      );

      setLeaderboardEntries(
        entries.map((entry: any, idx: number) => ({
          id: String(entry.id ?? `entry-${idx}`),
          rank: Number(entry.rank ?? idx + 1),
          handle: typeof entry.handle === 'string' ? entry.handle : null,
          display_name: typeof entry.display_name === 'string' ? entry.display_name : null,
          wins: Number(entry.wins ?? 0),
          elo_rating: Number(entry.elo_rating ?? 0),
        })),
      );

      setHomeStats({
        activeBattles: battles.length,
        beatsInLibrary: beats.length,
        activeBattlers: entries.length,
        topRating: entries.length > 0 ? Number(entries[0].elo_rating ?? 0) : 0,
      });
    }

    void loadHomeData();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    {
      title: 'Active Battles',
      value: String(homeStats.activeBattles),
      subtitle: 'Live + queued',
      icon: <Swords className="w-5 h-5" />,
      color: 'orange' as const,
    },
    {
      title: 'Beats',
      value: String(homeStats.beatsInLibrary),
      subtitle: 'Loaded now',
      icon: <Mic className="w-5 h-5" />,
      color: 'purple' as const,
    },
    {
      title: 'Top Battlers',
      value: String(homeStats.activeBattlers),
      subtitle: 'Leaderboard sample',
      icon: <Users className="w-5 h-5" />,
      color: 'pink' as const,
    },
    {
      title: 'Top ELO',
      value: String(homeStats.topRating || 0),
      subtitle: 'Current #1',
      icon: <Trophy className="w-5 h-5" />,
      color: 'yellow' as const,
    },
  ];

  const handleLikeBattle = (battleId: string) => {
    setLikedBattles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(battleId)) {
        newSet.delete(battleId);
      } else {
        newSet.add(battleId);
      }
      return newSet;
    });
  };

  const handleLikeBeat = (beatId: string) => {
    setLikedBeats(prev => {
      const newSet = new Set(prev);
      if (newSet.has(beatId)) {
        newSet.delete(beatId);
      } else {
        newSet.add(beatId);
      }
      return newSet;
    });
  };

  return (
    <PremiumMobileLayout>
      <div className="space-y-6">
        {/* Hero Section */}
        <section className="relative">
          <HeroBanner className="h-80" />
        </section>

        {/* Quick Stats */}
        <section className="px-4">
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <MobileStatsCard {...stat} />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Search Bar */}
        <section className="px-4">
          <MobileSearchBar
            placeholder="Search battles, beats, or artists..."
            onSearch={setSearchQuery}
            showFilter={true}
            onFilterClick={() => setShowFilters(!showFilters)}
          />
        </section>

        {/* Featured Battles */}
        <section className="px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">
                Featured Battles
              </span>
            </h2>
            <Button asChild variant="ghost" size="sm" className="text-white/60">
              <Link href="/app/battles">View All</Link>
            </Button>
          </div>

          <div className="space-y-4">
            {featuredBattles.map((battle, index) => (
              <motion.div
                key={battle.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <MobileBattleCard
                  battle={battle}
                  onJoin={() => router.push(`/app/battles/room?battleId=${encodeURIComponent(battle.id)}`)}
                  onSpectate={() => router.push(`/app/battles/room?battleId=${encodeURIComponent(battle.id)}`)}
                />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Trending Beats */}
        <section className="px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Trending Beats
              </span>
            </h2>
            <Button asChild variant="ghost" size="sm" className="text-white/60">
              <Link href="/app/beats">Browse All</Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {trendingBeats.map((beat, index) => (
              <motion.div
                key={beat.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <MobileBeatCard
                  beat={beat}
                  isPlaying={false}
                  onPlayToggle={() => router.push('/app/beats')}
                  onSelect={() => router.push('/app/beats')}
                />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="px-4">
          <div className="grid grid-cols-2 gap-3">
            <Button asChild className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2">
              <Link href="/app/battles">
                <Swords className="w-5 h-5" />
                Start Battle
              </Link>
            </Button>
            <Button asChild className="bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2">
              <Link href="/app/battles/room">
                <Video className="w-5 h-5" />
                Watch Live
              </Link>
            </Button>
          </div>
        </section>

        {/* Leaderboard Preview */}
        <section className="px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                Top Battlers
              </span>
            </h2>
            <Button asChild variant="ghost" size="sm" className="text-white/60">
              <Link href="/app/community">View All</Link>
            </Button>
          </div>

          <Card className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/20 backdrop-blur-sm rounded-xl">
            <CardContent className="p-4">
              <div className="space-y-3">
                {leaderboardEntries.map((player) => (
                  <div key={player.rank} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        player.rank === 1 ? 'bg-yellow-500 text-black' :
                        player.rank === 2 ? 'bg-gray-400 text-black' :
                        'bg-orange-600 text-white'
                      }`}>
                        {player.rank}
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{player.display_name || player.handle || 'Unknown'}</p>
                        <p className="text-white/60 text-xs">{player.wins ?? 0} wins</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-yellow-400 font-bold text-sm">{player.elo_rating ?? 0}</p>
                      <p className="text-white/60 text-xs">ELO</p>
                    </div>
                  </div>
                ))}
                {leaderboardEntries.length === 0 ? (
                  <div className="text-white/60 text-sm">No leaderboard entries available.</div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA Section */}
        <section className="px-4 pb-8">
          <Card className="bg-gradient-to-br from-orange-900/40 via-purple-900/40 to-pink-900/40 border-white/10 backdrop-blur-sm rounded-2xl p-6">
            <CardContent className="text-center">
              <h2 className="text-2xl font-bold text-white mb-3">
                Ready to <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">DOMINATE</span>?
              </h2>
              <p className="text-white/80 mb-6">
                Join thousands of battlers in the ultimate hip-hop arena
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold py-3 rounded-full">
                  <Link href="/app/battles">Start Your First Battle</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10 py-3 rounded-full">
                  <Link href="/app/battles/room">Watch Live Battles</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </PremiumMobileLayout>
  );
};

export default PremiumMobileHomePage;
