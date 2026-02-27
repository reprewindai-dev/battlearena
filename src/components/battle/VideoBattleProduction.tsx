"use client";

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LiveBattleRoom } from './LiveBattleRoom';
import { BattleChat } from '@/components/chat/BattleChat';
import { BeatPlayer } from '@/components/audio/BeatPlayer';
import { getMatchmaking } from '@/lib/matchmaking/production';

interface VideoBattleProductionProps {
  battleId: string;
  userId: string;
  username: string;
}

export function VideoBattleProduction({ battleId, userId, username }: VideoBattleProductionProps) {
  const [battle, setBattle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const loadBattle = async () => {
      try {
        const matchmaking = getMatchmaking();
        const battleData = await matchmaking.getBattle(battleId);
        if (battleData) {
          setBattle(battleData);
        } else {
          setError('Battle not found');
        }
      } catch (err) {
        setError('Failed to load battle');
      } finally {
        setLoading(false);
      }
    };

    loadBattle();
  }, [battleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-center">
          <p className="text-lg">Loading battle...</p>
        </div>
      </div>
    );
  }

  if (error || !battle) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 text-center">
          <p className="text-red-500">{error || 'Battle not found'}</p>
          <Button onClick={() => window.history.back()} className="mt-4">
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Main Battle Area */}
      <div className="lg:col-span-2 space-y-4">
        {/* Battle Header */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Live Battle</h2>
              <p className="text-sm text-gray-600">
                {battle.queue_type.toUpperCase()} • {battle.battle_format}
              </p>
            </div>
            <Badge variant={battle.status === 'in_progress' ? 'default' : 'secondary'}>
              {battle.status}
            </Badge>
          </div>
        </Card>

        {/* Live Video Battle */}
        <LiveBattleRoom
          roomId={battle.room_id || battle.id}
          participantId={userId}
        />

        {/* Beat Selection */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Beat Selection</h3>
          <BeatPlayer 
            isPlaying={isPlaying}
            onPlayPause={() => setIsPlaying(!isPlaying)}
          />
        </Card>
      </div>

      {/* Chat and Info Sidebar */}
      <div className="space-y-4">
        {/* Battle Info */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Battle Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Format:</span>
              <span>{battle.battle_format}</span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span>{battle.queue_type}</span>
            </div>
            <div className="flex justify-between">
              <span>Entry Fee:</span>
              <span>${battle.entry_fee || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Prize Pool:</span>
              <span>${battle.prize_pool || 0}</span>
            </div>
          </div>
        </Card>

        {/* Live Chat */}
        <BattleChat
          roomId={battle.id}
          userId={userId}
          username={username}
        />
      </div>
    </div>
  );
}
