import React from 'react';
import { motion } from 'framer-motion';
import { BattleArenaLogo, BattleArenaWordmark } from '@/components/brand/Logo';
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
  Pause,
  Heart, 
  Share2, 
  Filter,
  Search,
  Star,
  Crown,
  Flame,
  Music,
  Radio,
  Headphones,
  Volume2,
  Eye
} from 'lucide-react';

// Premium Audio Player Component
interface PremiumAudioPlayerProps {
  beat: {
    id: string;
    title: string;
    artist: string;
    tempo: number;
    genre: string;
    duration_seconds: number;
    preview_url: string;
  };
  isPlaying: boolean;
  onPlayToggle: () => void;
  className?: string;
}

export const PremiumAudioPlayer: React.FC<PremiumAudioPlayerProps> = ({ 
  beat, 
  isPlaying, 
  onPlayToggle, 
  className = "" 
}) => {
  const [currentTime, setCurrentTime] = React.useState(0);
  const [volume, setVolume] = React.useState(0.7);
  const [isLiked, setIsLiked] = React.useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={`bg-gradient-to-br from-purple-900/30 to-orange-900/30 border-white/10 backdrop-blur-xl rounded-2xl p-6 ${className}`}>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-orange-500 rounded-xl flex items-center justify-center">
            <Music className="w-8 h-8 text-white" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg mb-1">{beat.title}</h3>
            <p className="text-white/70 text-sm mb-2">{beat.artist}</p>
            <div className="flex items-center gap-3">
              <Badge className="bg-purple-500 text-white text-xs">
                {beat.genre}
              </Badge>
              <span className="text-white/60 text-xs">{beat.tempo} BPM</span>
              <span className="text-white/60 text-xs">{formatTime(beat.duration_seconds)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-2 rounded-full hover:bg-white/10"
              onClick={() => setIsLiked(!isLiked)}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'text-red-400 fill-red-400' : 'text-white/60'}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="p-2 rounded-full hover:bg-white/10"
            >
              <Share2 className="w-5 h-5 text-white/60" />
            </Button>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-sm">{formatTime(currentTime)}</span>
            <span className="text-white/60 text-sm">{formatTime(beat.duration_seconds)}</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-full transition-all duration-300"
              style={{ width: `${(currentTime / beat.duration_seconds) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-2 rounded-full hover:bg-white/10"
            >
              <Clock className="w-4 h-4 text-white/60" />
            </Button>
            <Button
              onClick={onPlayToggle}
              className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 flex items-center justify-center"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="p-2 rounded-full hover:bg-white/10"
            >
              <Clock className="w-4 h-4 text-white/60 transform rotate-180" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-white/60" />
            <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Premium Battle Arena Component
interface PremiumBattleArenaProps {
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
  className?: string;
}

export const PremiumBattleArena: React.FC<PremiumBattleArenaProps> = ({ 
  battle, 
  onJoin, 
  onSpectate, 
  className = "" 
}) => {
  const [countdown, setCountdown] = React.useState(60);
  const [isSpectating, setIsSpectating] = React.useState(false);

  React.useEffect(() => {
    if (battle.status === 'active' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, battle.status]);

  return (
    <Card className={`bg-gradient-to-br from-purple-900/30 to-orange-900/30 border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden ${className}`}>
      {/* Battle Header */}
      <div className="relative h-48 bg-gradient-to-br from-orange-500/20 to-pink-500/20">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=400&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        
        {/* Live Badge */}
        {battle.status === 'active' && (
          <div className="absolute top-4 right-4">
            <Badge className="bg-red-500 text-white text-xs font-bold animate-pulse flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </Badge>
          </div>
        )}
        
        {/* Battle Type */}
        <div className="absolute top-4 left-4">
          <Badge className="bg-orange-500 text-white text-xs font-bold">
            {battle.battle_type.toUpperCase()}
          </Badge>
        </div>
        
        {/* Center Content */}
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-white font-bold text-xl mb-2">
            {battle.title || `Battle ${battle.room_code}`}
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full border-2 border-white" />
              <span className="text-white/80 text-sm">VS</span>
              <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full border-2 border-white" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white/60 text-sm">{battle.format}</span>
              {battle.status === 'active' && (
                <span className="text-red-400 font-bold text-sm">{countdown}s</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <CardContent className="p-6">
        {/* Battle Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-4 h-4 text-white/60" />
              <span className="text-white font-bold">{battle.current_participants}/{battle.max_participants}</span>
            </div>
            <span className="text-white/60 text-xs">Battlers</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Video className="w-4 h-4 text-red-400" />
              <span className="text-white font-bold">{battle.viewers || Math.floor(Math.random() * 1000) + 100}</span>
            </div>
            <span className="text-white/60 text-xs">Watching</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-white font-bold">{battle.entry_fee_tokens * 2}</span>
            </div>
            <span className="text-white/60 text-xs">Prize Pool</span>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold py-3 rounded-xl"
            onClick={onJoin}
            disabled={battle.status !== 'waiting'}
          >
            {battle.status === 'waiting' ? 'Join Battle' : battle.status === 'active' ? 'Battle in Progress' : 'Battle Ended'}
          </Button>
          <Button 
            variant="outline" 
            className="border-white/20 text-white hover:bg-white/10 px-6 rounded-xl"
            onClick={() => {
              setIsSpectating(!isSpectating);
              onSpectate?.();
            }}
          >
            {isSpectating ? <Eye className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Premium Leaderboard Component
interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  wins: number;
  losses: number;
  points: number;
  streak: number;
}

interface PremiumLeaderboardProps {
  entries: LeaderboardEntry[];
  title?: string;
  className?: string;
}

export const PremiumLeaderboard: React.FC<PremiumLeaderboardProps> = ({ 
  entries, 
  title = "Top Battlers", 
  className = "" 
}) => {
  return (
    <Card className={`bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-yellow-500/20 backdrop-blur-xl rounded-2xl ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              {title}
            </span>
          </h2>
          <Button variant="ghost" size="sm" className="text-white/60">
            View All
          </Button>
        </div>
        
        <div className="space-y-3">
          {entries.map((entry) => (
            <motion.div
              key={entry.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  entry.rank === 1 ? 'bg-yellow-500 text-black' :
                  entry.rank === 2 ? 'bg-gray-400 text-black' :
                  entry.rank === 3 ? 'bg-orange-600 text-white' :
                  'bg-white/20 text-white'
                }`}>
                  {entry.rank}
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full" />
                <div>
                  <p className="text-white font-bold">{entry.name}</p>
                  <p className="text-white/60 text-xs">
                    {entry.wins}W - {entry.losses}L
                    {entry.streak > 0 && ` • 🔥 ${entry.streak}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-yellow-400 font-bold">{entry.points}</p>
                <p className="text-white/60 text-xs">points</p>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Premium Tournament Bracket Component
interface TournamentMatch {
  id: string;
  round: number;
  match: number;
  player1: string;
  player2: string;
  winner?: string;
  status: 'upcoming' | 'live' | 'completed';
}

interface PremiumTournamentBracketProps {
  matches: TournamentMatch[];
  title?: string;
  className?: string;
}

export const PremiumTournamentBracket: React.FC<PremiumTournamentBracketProps> = ({ 
  matches, 
  title = "Tournament Bracket", 
  className = "" 
}) => {
  const rounds = [...new Set(matches.map(m => m.round))].sort();
  
  return (
    <Card className={`bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/20 backdrop-blur-xl rounded-2xl ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-400" />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {title}
            </span>
          </h2>
          <Button variant="ghost" size="sm" className="text-white/60">
            View Bracket
          </Button>
        </div>
        
        <div className="space-y-6">
          {rounds.map((round) => (
            <div key={round}>
              <h3 className="text-white/80 font-bold mb-3">Round {round}</h3>
              <div className="space-y-2">
                {matches
                  .filter(m => m.round === round)
                  .map((match) => (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          match.status === 'live' ? 'bg-red-500 animate-pulse' :
                          match.status === 'completed' ? 'bg-green-500' :
                          'bg-gray-500'
                        }`} />
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full" />
                          <span className={`text-sm font-medium ${
                            match.winner === match.player1 ? 'text-green-400' : 'text-white'
                          }`}>
                            {match.player1}
                          </span>
                        </div>
                        <span className="text-white/60 text-sm">vs</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            match.winner === match.player2 ? 'text-green-400' : 'text-white'
                          }`}>
                            {match.player2}
                          </span>
                          <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full" />
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold ${
                          match.status === 'live' ? 'text-red-400' :
                          match.status === 'completed' ? 'text-green-400' :
                          'text-gray-400'
                        }`}>
                          {match.status === 'live' ? 'LIVE' :
                           match.status === 'completed' ? 'FINISHED' :
                           'UPCOMING'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
