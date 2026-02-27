"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MatchmakingService, MatchmakingRequest } from "@/lib/pvp/MatchmakingService";
import { OpponentProfile } from "@/lib/pvp/OpponentOrchestrator";

interface RankedMatchmakingProps {
  playerId: string;
  playerMMR: number;
  placementMatches: number;
  totalPlacementMatches: number;
  onMatchFound: (match: any) => void;
}

export function RankedMatchmaking({ 
  playerId, 
  playerMMR, 
  placementMatches, 
  totalPlacementMatches,
  onMatchFound 
}: RankedMatchmakingProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'connecting'>('idle');
  const [opponent, setOpponent] = useState<OpponentProfile | null>(null);
  const [matchTiming, setMatchTiming] = useState<any>(null);
  const [searchProgress, setSearchProgress] = useState(0);

  const matchmakingService = new MatchmakingService();

  const getRankTier = (mmr: number) => {
    if (mmr < 1200) return { name: 'Underground', color: 'bg-gray-500' };
    if (mmr < 1800) return { name: 'Contender', color: 'bg-blue-500' };
    if (mmr < 2200) return { name: 'Headliner', color: 'bg-purple-500' };
    return { name: 'Icon', color: 'bg-yellow-500' };
  };

  const getPlacementProgress = () => {
    return (placementMatches / totalPlacementMatches) * 100;
  };

  const startRankedMatchmaking = async () => {
    setIsSearching(true);
    setSearchStatus('searching');
    setSearchProgress(0);

    const request: MatchmakingRequest = {
      playerId,
      skillEstimate: playerMMR,
      preferredMode: 'ranked',
      latencyRegion: 'us-east'
    };

    try {
      const progressInterval = setInterval(() => {
        setSearchProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const match = await matchmakingService.findMatch(request);
      
      clearInterval(progressInterval);
      setSearchProgress(100);

      setSearchStatus('found');
      setOpponent(match.opponentProfile);
      setMatchTiming(match.pacingPlan);

      setTimeout(() => {
        setSearchStatus('connecting');
        
        setTimeout(() => {
          onMatchFound({
            matchId: match.matchId,
            opponent: match.opponentProfile,
            opponentType: match.opponentType,
            timing: match.pacingPlan,
            mode: 'ranked'
          });
        }, match.pacingPlan.connectTime);
      }, 700 + Math.random() * 500);

    } catch (error) {
      console.error('Ranked matchmaking failed:', error);
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
    return "Challenger"; // Always use neutral language for ranked
  };

  const playerRank = getRankTier(playerMMR);

  if (isSearching) {
    return (
      <Card className="p-6 max-w-md mx-auto">
        <div className="text-center space-y-4">
          {searchStatus === 'searching' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <h3 className="text-lg font-semibold">Finding opponent...</h3>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${searchProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">
                Competitive matchmaking in progress...
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
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
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

                <div className="text-sm text-purple-600 animate-pulse">
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
                  Preparing ranked battle arena
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    );
  }

  const isUnranked = placementMatches < totalPlacementMatches;

  return (
    <Card className="p-6 max-w-md mx-auto">
      <div className="text-center space-y-4">
        <h3 className="text-lg font-semibold">Ranked Match</h3>
        <p className="text-sm text-gray-600">
          Compete for rank and climb the leaderboard.
        </p>
        
        <div className="space-y-3">
          {isUnranked ? (
            <>
              <div className="flex items-center justify-center space-x-2">
                <Badge variant="outline" className="text-sm">
                  Rank: Unranked
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  Placement Matches: {placementMatches} / {totalPlacementMatches}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getPlacementProgress()}%` }}
                  ></div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${playerRank.color}`}></div>
              <Badge variant="outline" className="text-sm">
                Rank: {playerRank.name}
              </Badge>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500 space-y-1">
          <div>Competitive matchmaking enabled</div>
          <div>Battles begin in seconds</div>
        </div>

        <Button 
          onClick={startRankedMatchmaking}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          Start Ranked Match
        </Button>

        <div className="text-xs text-gray-400 space-y-1">
          <div>• Skill-based matchmaking ensures fair and competitive battles</div>
        </div>
      </div>
    </Card>
  );
}
