"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { enqueue, getStatus } from "@/lib/matchmaking/client";
import { getClientSessionUser } from "@/lib/auth/client-session";

export function RankedQueueCard() {
  const [isQueued, setIsQueued] = useState(false);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const sessionUser = await getClientSessionUser();
      setUser(sessionUser);
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (isQueued && user) {
      const interval = setInterval(async () => {
        const status = await getStatus(user.id, 'ranked');
        setQueueStatus(status);
        
        if (status?.status === 'matched') {
          setIsQueued(false);
          // Navigate to battle
          window.location.href = `/app/battles/room/${status.battle_id}`;
        }
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isQueued, user]);

  const handleJoinQueue = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const result = await enqueue(user.id, 'ranked');
      setQueueStatus(result);
      
      if (result.status === 'matched') {
        // Navigate directly to battle
        window.location.href = `/app/battles/room/${result.battle_id}`;
      } else {
        setIsQueued(true);
      }
    } catch (error) {
      console.error('Failed to join queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!user) return;
    
    try {
      await enqueue(user.id, 'ranked'); // This will handle leaving
      setIsQueued(false);
      setQueueStatus(null);
    } catch (error) {
      console.error('Failed to leave queue:', error);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Ranked Battles</h3>
          <p className="text-sm text-gray-600">Compete for ELO rating and prizes</p>
        </div>
        <Badge variant="default" className="bg-red-500">RANKED</Badge>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Format:</span>
            <p className="text-gray-600">60s rounds</p>
          </div>
          <div>
            <span className="font-medium">Entry:</span>
            <p className="text-gray-600">$5.00</p>
          </div>
          <div>
            <span className="font-medium">Prize:</span>
            <p className="text-gray-600">$10.00</p>
          </div>
          <div>
            <span className="font-medium">ELO:</span>
            <p className="text-gray-600">Rating based</p>
          </div>
        </div>

        {isQueued ? (
          <div className="space-y-3">
            <div className="text-center">
              <div className="animate-pulse">
                <p className="text-sm text-gray-600">Finding opponent...</p>
                <p className="text-xs text-gray-500 mt-1">
                  Queue time: {Math.floor((Date.now() - new Date(queueStatus?.created_at || Date.now()).getTime()) / 1000)}s
                </p>
              </div>
            </div>
            <Button 
              onClick={handleLeaveQueue}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              Leave Queue
            </Button>
          </div>
        ) : (
          <Button 
            onClick={handleJoinQueue}
            className="w-full"
            disabled={loading || !user}
          >
            {loading ? "Joining..." : "Join Ranked Queue"}
          </Button>
        )}
      </div>
    </Card>
  );
}
