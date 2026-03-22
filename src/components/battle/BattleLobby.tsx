'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users, Eye, Swords, Coins, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface Battle {
  id: string;
  title?: string;
  room_code: string;
  battle_type: 'ranked' | 'casual' | 'tournament';
  format: '30s' | '60s' | '90s';
  entry_fee_tokens: number;
  max_participants: number;
  current_participants: number;
  status: 'waiting' | 'active' | 'completed';
  created_by: string;
  created_at: string;
}

interface BattleLobbyProps {
  onJoinBattle: (battleId: string) => void;
  onSpectateBattle: (battleId: string) => void;
  onCreateBattle: () => void;
}

export default function BattleLobby({ onJoinBattle, onSpectateBattle, onCreateBattle }: BattleLobbyProps) {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    battle_type: 'all',
    format: 'all',
    status: 'all'
  });

  useEffect(() => {
    void fetchBattles();
  }, []);

  async function fetchBattles() {
    try {
      setLoading(true);
      const response = await fetch('/api/battles');
      if (!response.ok) throw new Error('Failed to fetch battles');
      const data = await response.json();
      setBattles(data.battles || []);
    } catch (error) {
      console.error('Error fetching battles:', error);
      toast.error('Failed to load battles');
    } finally {
      setLoading(false);
    }
  }

  const filteredBattles = useMemo(() => {
    return battles.filter((battle) => {
      const matchesSearch =
        !searchTerm ||
        battle.room_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (battle.title && battle.title.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = filters.battle_type === 'all' || battle.battle_type === filters.battle_type;
      const matchesFormat = filters.format === 'all' || battle.format === filters.format;
      const matchesStatus = filters.status === 'all' || battle.status === filters.status;

      return matchesSearch && matchesType && matchesFormat && matchesStatus;
    });
  }, [battles, searchTerm, filters]);

  function getBattleTypeColor(type: string) {
    switch (type) {
      case 'ranked':
        return 'bg-red-500';
      case 'casual':
        return 'bg-blue-500';
      case 'tournament':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'waiting':
        return 'bg-green-500';
      case 'active':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Spitzone</h1>
          <p className="text-gray-400">Join or spectate live battles</p>
        </div>
        <Button onClick={onCreateBattle} className="bg-primary hover:bg-primary/90">
          <Swords className="w-4 h-4 mr-2" />
          Create Battle
        </Button>
      </div>

      <Card className="bg-black/20 border-white/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-medium text-white">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search battles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400"
              />
            </div>

            <Select value={filters.battle_type} onValueChange={(value) => setFilters((prev) => ({ ...prev, battle_type: value }))}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Battle Type" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ranked">Ranked</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="tournament">Tournament</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.format} onValueChange={(value) => setFilters((prev) => ({ ...prev, format: value }))}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20">
                <SelectItem value="all">All Formats</SelectItem>
                <SelectItem value="30s">30s</SelectItem>
                <SelectItem value="60s">60s</SelectItem>
                <SelectItem value="90s">90s</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={`loading-${i}`} className="bg-black/20 border-white/10">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="h-4 bg-white/10 rounded animate-pulse w-32" />
                          <div className="h-3 bg-white/5 rounded animate-pulse w-24" />
                        </div>
                        <div className="h-6 bg-white/10 rounded animate-pulse w-16" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            : filteredBattles.length === 0
              ? (
                <div className="col-span-full py-12 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Swords className="w-8 h-8 text-white/30" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">No battles found</h3>
                    <p className="text-white/60 text-sm mb-4">
                      {searchTerm || filters.battle_type !== 'all' || filters.format !== 'all' || filters.status !== 'all'
                        ? 'Try adjusting your search filters'
                        : 'Be the first to create a battle!'}
                    </p>
                    <Button onClick={onCreateBattle} className="bg-primary hover:bg-primary/90">
                      Create Battle
                    </Button>
                  </div>
                </div>
                )
              : (
                filteredBattles.map((battle) => (
                  <motion.div
                    key={battle.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="bg-black/20 border-white/10 hover:bg-black/30 transition-colors">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center space-x-2">
                            <Badge className={`${getBattleTypeColor(battle.battle_type)} text-white`}>
                              {battle.battle_type}
                            </Badge>
                            <Badge className={`${getStatusColor(battle.status)} text-white`}>
                              {battle.status}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">{formatTimeAgo(battle.created_at)}</p>
                          </div>
                        </div>

                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium">{battle.title || `Battle ${battle.room_code}`}</span>
                            <span className="text-gray-400 text-sm">{battle.format}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Users className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-300 text-sm">{battle.current_participants}/{battle.max_participants}</span>
                            </div>
                            {battle.entry_fee_tokens > 0 ? (
                              <div className="flex items-center space-x-1">
                                <Coins className="w-4 h-4 text-yellow-400" />
                                <span className="text-yellow-400 text-sm">{battle.entry_fee_tokens}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => onJoinBattle(battle.id)}
                            disabled={battle.status !== 'waiting' || battle.current_participants >= battle.max_participants}
                            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50"
                          >
                            {battle.status === 'waiting' ? 'Join Battle' : battle.status}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => onSpectateBattle(battle.id)}
                            className="border-white/20 text-white hover:bg-white/10"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
                )}
        </AnimatePresence>
      </div>
    </div>
  );
}
