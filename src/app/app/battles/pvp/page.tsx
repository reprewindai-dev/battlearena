"use client";

import { useState, useEffect } from "react";
import { PvPMatchmaking } from "@/components/matchmaking/PvPMatchmaking";
import { RankedMatchmaking } from "@/components/matchmaking/RankedMatchmaking";
import { CasualMatchmaking } from "@/components/matchmaking/CasualMatchmaking";
import { PvPBattleRoom } from "@/components/battle/PvPBattleRoom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClientSessionUser } from "@/lib/auth/client-session";

export default function PvPPage() {
  const [user, setUser] = useState<any>(null);
  const [currentMatch, setCurrentMatch] = useState<any>(null);
  const [battleResult, setBattleResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await getClientSessionUser();
        setUser(userData);
      } catch (error) {
        console.error("Failed to load user:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const handleMatchFound = (match: any) => {
    setCurrentMatch(match);
  };

  const handleBattleEnd = (result: any) => {
    setBattleResult(result);
    
    // Record match result for telemetry
    console.log("Battle completed:", result);
    
    // Show post-match UI for a few seconds, then return to matchmaking
    setTimeout(() => {
      setCurrentMatch(null);
      setBattleResult(null);
    }, 5000);
  };

  const getPlayerMMR = () => {
    // In real implementation, this would come from user profile
    return user?.mmr || 1500;
  };

  const getPlacementMatches = () => {
    // In real implementation, this would come from user profile
    return user?.placement_matches || 0;
  };

  const getTotalPlacementMatches = () => {
    return 5; // Standard placement matches
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading PvP system...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-6 max-w-md">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please log in to access PvP battles.</p>
          <Button onClick={() => window.location.href = "/auth/login"}>
            Log In
          </Button>
        </Card>
      </div>
    );
  }

  if (battleResult) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">
            {battleResult.winner === "user" ? "🎉 Victory!" : "💪 Defeat"}
          </h2>
          
          <div className="space-y-2 mb-6">
            <div className="text-lg">
              Final Score: {battleResult.userScore} - {battleResult.opponentScore}
            </div>
            {battleResult.isCloseMatch && (
              <div className="text-orange-600 font-semibold">
                🔥 Close Match!
              </div>
            )}
            <div className="text-sm text-gray-600">
              Opponent Type: {battleResult.opponentType}
            </div>
          </div>

          <div className="space-y-3">
            <Button onClick={() => window.location.reload()} className="w-full">
              Play Again
            </Button>
            <Button variant="outline" onClick={() => window.location.href = "/app/battles"} className="w-full">
              Back to Battles
            </Button>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            Returning to matchmaking in 5 seconds...
          </div>
        </Card>
      </div>
    );
  }

  if (currentMatch) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PvPBattleRoom match={currentMatch} onBattleEnd={handleBattleEnd} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">PvP Battles</h1>
          <p className="text-gray-600">
            Experience competitive rap battles with skill-based matchmaking
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="ranked" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ranked">Ranked</TabsTrigger>
              <TabsTrigger value="casual">Casual</TabsTrigger>
            </TabsList>

            <TabsContent value="ranked">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4">Competitive Ranked Matches</h2>
                <RankedMatchmaking 
                  playerId={user.id}
                  playerMMR={getPlayerMMR()}
                  placementMatches={getPlacementMatches()}
                  totalPlacementMatches={getTotalPlacementMatches()}
                  onMatchFound={handleMatchFound}
                />
              </div>
            </TabsContent>

            <TabsContent value="casual">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4">Relaxed Casual Matches</h2>
                <CasualMatchmaking 
                  playerId={user.id}
                  playerMMR={getPlayerMMR()}
                  onMatchFound={handleMatchFound}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
