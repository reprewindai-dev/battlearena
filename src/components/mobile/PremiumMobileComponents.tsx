import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BattleArenaLogo, BattleArenaWordmark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Menu, 
  X, 
  Home, 
  Swords, 
  Trophy, 
  User, 
  Settings, 
  Mic, 
  Video, 
  Users, 
  Clock, 
  TrendingUp, 
  Zap, 
  Filter,
  Play,
  Pause,
  Volume2,
  Heart,
  Share2,
  MoreVertical
} from 'lucide-react';

interface PremiumMobileLayoutProps {
  children: React.ReactNode;
}

export const PremiumMobileLayout: React.FC<PremiumMobileLayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'battles', label: 'Battles', icon: Swords },
    { id: 'beats', label: 'Beats', icon: Mic },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <BattleArenaLogo size="small" />
            <BattleArenaWordmark size="small" />
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="p-2 rounded-lg bg-white/10 hover:bg-white/20">
              <Search className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/95 backdrop-blur-xl"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-black/90 backdrop-blur-xl border-r border-white/10 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <BattleArenaLogo size="medium" />
                  <BattleArenaWordmark size="medium" />
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <nav className="space-y-2">
                {navItems.map((item) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    className={`w-full justify-start gap-3 p-3 rounded-lg transition-all ${
                      activeTab === item.id 
                        ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white' 
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Button>
                ))}
              </nav>
              
              <div className="mt-8 pt-8 border-t border-white/10">
                <Button className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600">
                  Start Battle
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="pt-16 pb-20">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/10 z-50">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className={`flex flex-col gap-1 p-2 rounded-lg transition-all ${
                activeTab === item.id 
                  ? 'text-orange-400' 
                  : 'text-white/50 hover:text-white/80'
              }`}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Button>
          ))}
        </div>
      </nav>
    </div>
  );
};

// Premium Mobile Battle Card
interface MobileBattleCardProps {
  battle: {
    id: string;
    title?: string;
    room_code: string;
    battle_type: 'ranked' | 'casual' | 'tournament';
    format: '30s' | '60s' | '90s';
    entry_fee_tokens: number;
    status: 'waiting' | 'active' | 'completed';
    current_participants: number;
    max_participants: number;
    viewers?: number;
  };
  onJoin?: () => void;
  onSpectate?: () => void;
}

export const MobileBattleCard: React.FC<MobileBattleCardProps> = ({ battle, onJoin, onSpectate }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 to-orange-900/20 border-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
      <div className="relative h-32 bg-gradient-to-br from-orange-500/20 to-pink-500/20">
        {/* Live indicator */}
        {battle.status === 'active' && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-red-500 text-white text-xs font-bold animate-pulse flex items-center gap-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </Badge>
          </div>
        )}
        
        {/* Battle type badge */}
        <div className="absolute top-2 left-2">
          <Badge className="bg-orange-500 text-white text-xs font-bold">
            {battle.battle_type.toUpperCase()}
          </Badge>
        </div>
        
        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-white font-bold text-lg mb-1">
              {battle.title || `Battle ${battle.room_code}`}
            </h3>
            <p className="text-white/70 text-sm">{battle.format}</p>
          </div>
        </div>
      </div>
      
      <CardContent className="p-4">
        {/* Participants */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full" />
            <span className="text-white/80 text-sm">vs</span>
            <div className="w-6 h-6 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full" />
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-white/60" />
            <span className="text-white/60 text-sm">
              {battle.current_participants}/{battle.max_participants}
            </span>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            <Video className="w-4 h-4 text-red-400" />
            <span className="text-white/60 text-sm">
              {battle.viewers || Math.floor(Math.random() * 1000) + 100} watching
            </span>
          </div>
          {battle.entry_fee_tokens > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-yellow-400 text-sm font-bold">{battle.entry_fee_tokens}</span>
              <span className="text-white/60 text-sm">tokens</span>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2">
          <Button 
            className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold py-2"
            onClick={onJoin}
            disabled={battle.status !== 'waiting'}
          >
            {battle.status === 'waiting' ? 'Join Battle' : battle.status}
          </Button>
          <Button 
            variant="outline" 
            className="border-white/20 text-white hover:bg-white/10 p-2"
            onClick={onSpectate}
          >
            <Play className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Premium Mobile Beat Card
interface MobileBeatCardProps {
  beat: {
    id: string;
    title: string;
    artist: string;
    tempo: number;
    genre: string;
    duration_seconds: number;
    preview_url: string;
    usage_count: number;
  };
  onSelect?: () => void;
  isPlaying?: boolean;
  onPlayToggle?: () => void;
}

export const MobileBeatCard: React.FC<MobileBeatCardProps> = ({ 
  beat, 
  onSelect, 
  isPlaying = false, 
  onPlayToggle 
}) => {
  const [isLiked, setIsLiked] = useState(false);

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-white/10 backdrop-blur-sm rounded-xl overflow-hidden cursor-pointer group">
      <div className="relative h-24 bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
        <Button
          variant="ghost"
          className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all group-hover:scale-110"
          onClick={(e) => {
            e.stopPropagation();
            onPlayToggle?.();
          }}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </Button>
        
        {/* Genre badge */}
        <div className="absolute top-2 left-2">
          <Badge className="bg-purple-500 text-white text-xs font-bold">
            {beat.genre}
          </Badge>
        </div>
        
        {/* Tempo indicator */}
        <div className="absolute top-2 right-2">
          <div className="bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
            <span className="text-white text-xs font-bold">{beat.tempo} BPM</span>
          </div>
        </div>
      </div>
      
      <CardContent className="p-3" onClick={onSelect}>
        <h4 className="text-white font-bold text-sm mb-1 truncate">{beat.title}</h4>
        <p className="text-white/60 text-xs mb-2 truncate">{beat.artist}</p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className="text-green-400 text-xs font-bold">
              {beat.usage_count} uses
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="p-1 rounded hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                setIsLiked(!isLiked);
              }}
            >
              <Heart className={`w-3 h-3 ${isLiked ? 'text-red-400 fill-red-400' : 'text-white/60'}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="p-1 rounded hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Share2 className="w-3 h-3 text-white/60" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Premium Mobile Stats Card
interface MobileStatsCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: 'orange' | 'purple' | 'pink' | 'yellow';
  trend?: string;
}

export const MobileStatsCard: React.FC<MobileStatsCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color,
  trend 
}) => {
  const colorClasses = {
    orange: 'from-orange-900/20 to-orange-800/20 border-orange-500/20',
    purple: 'from-purple-900/20 to-purple-800/20 border-purple-500/20',
    pink: 'from-pink-900/20 to-pink-800/20 border-pink-500/20',
    yellow: 'from-yellow-900/20 to-yellow-800/20 border-yellow-500/20',
  };

  const textColors = {
    orange: 'text-orange-400',
    purple: 'text-purple-400',
    pink: 'text-pink-400',
    yellow: 'text-yellow-400',
  };

  return (
    <Card className={`bg-gradient-to-br ${colorClasses[color]} border backdrop-blur-sm rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg bg-black/30 ${textColors[color]}`}>
          {icon}
        </div>
        {trend && (
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className="text-green-400 text-xs font-bold">{trend}</span>
          </div>
        )}
      </div>
      
      <div className={`text-2xl font-bold ${textColors[color]} mb-1`}>
        {value}
      </div>
      
      <div className="text-white/60 text-sm">
        {title}
      </div>
      
      <div className="text-white/40 text-xs mt-1">
        {subtitle}
      </div>
    </Card>
  );
};

// Premium Mobile Search Bar
interface MobileSearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  showFilter?: boolean;
  onFilterClick?: () => void;
}

export const MobileSearchBar: React.FC<MobileSearchBarProps> = ({ 
  placeholder = "Search...", 
  onSearch,
  showFilter = true,
  onFilterClick 
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-all"
        />
        {showFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10"
            onClick={onFilterClick}
          >
            <Filter className="w-4 h-4 text-white/60" />
          </Button>
        )}
      </div>
    </form>
  );
};
