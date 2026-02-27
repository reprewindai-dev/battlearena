"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MatchmakingService, MatchmakingRequest } from "@/lib/pvp/MatchmakingService";
import { OpponentProfile } from "@/lib/pvp/OpponentOrchestrator";

interface PvPMatchmakingProps {
  playerId: string;
  playerMMR: number;
  onMatchFound: (match: any) => void;
}

export function PvPMatchmaking({ playerId, playerMMR, onMatchFound }: PvPMatchmakingProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'connecting'>('idle');
  const [opponent, setOpponent] = useState<OpponentProfile | null>(null);
  const [matchTiming, setMatchTiming] = useState<any>(null);
  const [searchProgress, setSearchProgress] = useState(0);

  const matchmakingService = new MatchmakingService();

  const startMatchmaking = async (mode: 'ranked' | 'casual') => {
    setIsSearching(true);
    setSearchStatus('searching');
    setSearchProgress(0);

    const request: MatchmakingRequest = {
      playerId,
      skillEstimate: playerMMR,
      preferredMode: mode,
      latencyRegion: 'us-east' // Would get from user's location
    };

    try {
      // Simulate search progress
      const progressInterval = setInterval(() => {
        setSearchProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const match = await matchmakingService.findMatch(request);
      
      clearInterval(progressInterval);
      setSearchProgress(100);

      // "Opponent found" phase
      setSearchStatus('found');
      setOpponent(match.opponentProfile);
      setMatchTiming(match.pacingPlan);

      // Micro-delay "connecting..." phase
      setTimeout(() => {
        setSearchStatus('connecting');
        
        // Start match immediately after connecting
        setTimeout(() => {
          onMatchFound({
            matchId: match.matchId,
            opponent: match.opponentProfile,
            opponentType: match.opponentType,
            timing: match.pacingPlan
          });
        }, match.pacingPlan.connectTime);
      }, 700 + Math.random() * 500); // 0.7-1.2s

    } catch (error) {
      console.error('Matchmaking failed:', error);
      setIsSearching(false);
      setSearchStatus('idle');
      setSearchProgress(0);
    }
  };

  const cancelSearch = () => {
    setIsSearching(false);
    setSearchStatus('idle');
    setOpponent(null);
    setMatchTiming(null);
    setSearchProgress(0);
  };

  const getOpponentTypeLabel = (opponent: OpponentProfile) => {
    if (opponent.isLive) return "Online";
    if (opponent.isGhost) return "Challenger";
    return "Rival";
  };

  const getOpponentTypeColor = (opponent: OpponentProfile) => {
    if (opponent.isLive) return "bg-green-500";
    if (opponent.isGhost) return "bg-blue-500";
    return "bg-purple-500";
  };

  if (isSearching) {
    return (
      <Card className="p-6 max-w-md mx-auto">
        <div className="text-center space-y-4">
          {searchStatus === 'searching' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h3 className="text-lg font-semibold">Finding opponent...</h3>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${searchProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">
                Finding opponent...
              </p>
              <Button variant="outline" onClick={cancelSearch}>
                Cancel
              </Button>
            </>
          )}

          {searchStatus === 'found' && opponent && (
            <>
              <div className="space-y-4">
                <div className="text-green-600 text-lg font-semibold">Opponent found!</div>
                
                <div className="flex items-center justify-center space-x-4">
                  <div className="text-center">
                    <Avatar className="h-16 w-16 mx-auto mb-2">
                      <AvatarImage src={opponent.avatar} />
                      <AvatarFallback className="text-2xl">
                        {opponent.name[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="font-semibold">{opponent.name}</div>
                    <Badge variant="secondary" className="text-xs">
                      {opponent.rank}
                    </Badge>
                    <div className="text-sm text-gray-600">
                      {opponent.badge} {opponent.rank}
                    </div>
                    <div className="flex items-center justify-center space-x-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${getOpponentTypeColor(opponent)}`}></div>
                      <span className="text-xs text-gray-500">
                        {getOpponentTypeLabel(opponent)}
                      </span>
                    </div>
                    {opponent.streak !== 0 && (
                      <div className="text-xs text-gray-500">
                        Streak: {opponent.streak > 0 ? '+' : ''}{opponent.streak}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Win Rate:</span>
                    <span>{Math.round(opponent.winRate * 100)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Style:</span>
                    <span className="capitalize">{opponent.persona.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="text-sm text-blue-600 animate-pulse">
                  Connecting...
                </div>
              </div>
            </>
          )}

          {searchStatus === 'connecting' && (
            <>
              <div className="animate-pulse">
                <div className="text-lg font-semibold">Establishing connection...</div>
                <div className="text-sm text-gray-600 mt-2">
                  Preparing battle arena
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 max-w-md mx-auto">
      <div className="text-center space-y-4">
        <h3 className="text-lg font-semibold">Quick Match</h3>
        <p className="text-sm text-gray-600">
          Find an opponent and start battling!
        </p>
        
        <div className="text-sm text-gray-500 space-y-1">
          <div>Your Rank: {playerMMR < 1200 ? 'Underground' : playerMMR < 1800 ? 'Contender' : playerMMR < 2200 ? 'Headliner' : 'Icon'}</div>
          <div>Competitive matchmaking enabled</div>
        </div>

        <div className="flex gap-3 justify-center">
          <Button 
            onClick={() => startMatchmaking('casual')}
            className="flex-1"
            variant="outline"
          >
            Casual
          </Button>
          <Button 
            onClick={() => startMatchmaking('ranked')}
            className="flex-1"
          >
            Ranked
          </Button>
        </div>

        <div className="text-xs text-gray-400 space-y-1">
          <div>• Skill-based matchmaking ensures fair battles</div>
        </div>
      </div>
    </Card>
  );
}
