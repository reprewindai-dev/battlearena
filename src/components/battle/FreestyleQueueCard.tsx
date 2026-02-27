"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { enqueue, getStatus } from "@/lib/matchmaking/client";
import { getClientSessionUser } from "@/lib/auth/client-session";
import { getMatchmaking } from "@/lib/matchmaking/client";

export function FreestyleQueueCard() {
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
        const status = await getStatus(user.id);
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
      const result = await enqueue(user.id, 'freestyle');
      console.log('Queue result:', result);
      setQueueStatus(result);
      
      if (result.status === 'matched') {
        // Navigate to battle room
        if (result.is_bot_match) {
          window.location.href = `/app/battles/bot-room/${result.battle_id}`;
        } else {
          window.location.href = `/app/battles/room/${result.battle_id}`;
        }
      } else {
        setIsQueued(true);
      }
    } catch (error: any) {
      console.error('Failed to join queue:', error);
      console.error('Error details:', error.message, error.code);
      console.error('Full error:', JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveQueue = async () => {
    if (!user) return;
    
    try {
      const matchmaking = getMatchmaking();
      await matchmaking.dequeue(user.id);
      setIsQueued(false);
      setQueueStatus(null);
    } catch (error: any) {
      console.error('Failed to leave queue:', error);
      console.error('Error details:', error.message, error.code);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Freestyle Battles</h3>
          <p className="text-sm text-gray-600">Practice and have fun</p>
        </div>
        <Badge variant="secondary">CASUAL</Badge>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Format:</span>
            <p className="text-gray-600">60s rounds</p>
          </div>
          <div>
            <span className="font-medium">Entry:</span>
            <p className="text-gray-600">Free</p>
          </div>
          <div>
            <span className="font-medium">Prize:</span>
            <p className="text-gray-600">None</p>
          </div>
          <div>
            <span className="font-medium">ELO:</span>
            <p className="text-gray-600">Not affected</p>
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
            {loading ? "Joining..." : "Join Freestyle Queue"}
          </Button>
        )}
      </div>
    </Card>
  );
}
