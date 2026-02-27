import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [likedBattles, setLikedBattles] = useState<Set<string>>(new Set());
  const [likedBeats, setLikedBeats] = useState<Set<string>>(new Set());

  // Mock data for demonstration
  const featuredBattles = [
    {
      id: '1',
      title: 'Trap God Challenge',
      room_code: 'TRAP001',
      battle_type: 'ranked' as const,
      format: '60s' as const,
      entry_fee_tokens: 100,
      status: 'active' as const,
      current_participants: 2,
      max_participants: 2,
      viewers: 1234,
    },
    {
      id: '2',
      title: 'Drill Lord Battle',
      room_code: 'DRILL002',
      battle_type: 'casual' as const,
      format: '30s' as const,
      entry_fee_tokens: 0,
      status: 'waiting' as const,
      current_participants: 1,
      max_participants: 2,
      viewers: 567,
    },
    {
      id: '3',
      title: 'Underground Cypher',
      room_code: 'UND003',
      battle_type: 'tournament' as const,
      format: '90s' as const,
      entry_fee_tokens: 500,
      status: 'active' as const,
      current_participants: 2,
      max_participants: 2,
      viewers: 2890,
    },
  ];

  const trendingBeats = [
    {
      id: '1',
      title: 'Neon Dreams',
      artist: 'Arena Producer',
      tempo: 92,
      genre: 'hip-hop',
      duration_seconds: 32,
      preview_url: 'https://storage.googleapis.com/arena-beats/previews/neon-dreams.mp3',
      usage_count: 1234,
    },
    {
      id: '2',
      title: 'Glass City',
      artist: 'Arena Producer',
      tempo: 104,
      genre: 'hip-hop',
      duration_seconds: 28,
      preview_url: 'https://storage.googleapis.com/arena-beats/previews/glass-city.mp3',
      usage_count: 987,
    },
    {
      id: '3',
      title: 'Ion Runner',
      artist: 'Arena Producer',
      tempo: 120,
      genre: 'electronic',
      duration_seconds: 24,
      preview_url: 'https://storage.googleapis.com/arena-beats/previews/ion-runner.mp3',
      usage_count: 756,
    },
    {
      id: '4',
      title: 'Midnight Groove',
      artist: 'Arena Producer',
      tempo: 88,
      genre: 'hip-hop',
      duration_seconds: 36,
      preview_url: 'https://storage.googleapis.com/arena-beats/previews/midnight-groove.mp3',
      usage_count: 543,
    },
  ];

  const stats = [
    {
      title: 'Active Battles',
      value: '50K+',
      subtitle: 'Happening now',
      icon: <Swords className="w-5 h-5" />,
      color: 'orange' as const,
      trend: '+12%',
    },
    {
      title: 'Beats',
      value: '100K+',
      subtitle: 'In library',
      icon: <Mic className="w-5 h-5" />,
      color: 'purple' as const,
      trend: '+8%',
    },
    {
      title: 'Battlers',
      value: '25K+',
      subtitle: 'Active users',
      icon: <Users className="w-5 h-5" />,
      color: 'pink' as const,
      trend: '+15%',
    },
    {
      title: 'Prizes',
      value: '$1M+',
      subtitle: 'Won this month',
      icon: <Trophy className="w-5 h-5" />,
      color: 'yellow' as const,
      trend: '+20%',
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
            <Button variant="ghost" size="sm" className="text-white/60">
              View All
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
                  onJoin={() => console.log('Join battle:', battle.id)}
                  onSpectate={() => console.log('Spectate battle:', battle.id)}
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
            <Button variant="ghost" size="sm" className="text-white/60">
              Browse All
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
                  onPlayToggle={() => console.log('Play beat:', beat.id)}
                  onSelect={() => console.log('Select beat:', beat.id)}
                />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="px-4">
          <div className="grid grid-cols-2 gap-3">
            <Button className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2">
              <Swords className="w-5 h-5" />
              Start Battle
            </Button>
            <Button className="bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2">
              <Video className="w-5 h-5" />
              Watch Live
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
            <Button variant="ghost" size="sm" className="text-white/60">
              View All
            </Button>
          </div>

          <Card className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/20 backdrop-blur-sm rounded-xl">
            <CardContent className="p-4">
              <div className="space-y-3">
                {[
                  { rank: 1, name: 'TrapKing', wins: 142, points: 2840 },
                  { rank: 2, name: 'DrillLord', wins: 128, points: 2560 },
                  { rank: 3, name: 'CypherMaster', wins: 115, points: 2300 },
                ].map((player) => (
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
                        <p className="text-white font-bold text-sm">{player.name}</p>
                        <p className="text-white/60 text-xs">{player.wins} wins</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-yellow-400 font-bold text-sm">{player.points}</p>
                      <p className="text-white/60 text-xs">points</p>
                    </div>
                  </div>
                ))}
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
                <Button className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold py-3 rounded-full">
                  Start Your First Battle
                </Button>
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 py-3 rounded-full">
                  Watch Live Battles
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
