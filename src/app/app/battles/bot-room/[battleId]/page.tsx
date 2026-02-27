"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BotBattleRoom } from "@/components/battle/BotBattleRoom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BotBattleRoomPage() {
  const params = useParams();
  const router = useRouter();
  const [battle, setBattle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBattle = async () => {
      try {
        const response = await fetch(`/api/battles/${params.battleId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch battle");
        }
        const data = await response.json();
        setBattle(data.battle);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (params.battleId) {
      fetchBattle();
    }
  }, [params.battleId]);

  const handleBattleEnd = (winner: string, scores: any) => {
    // Update battle results in database
    fetch(`/api/battles/${params.battleId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        winner,
        scores,
      }),
    }).then(() => {
      // Redirect to results page after a delay
      setTimeout(() => {
        router.push(`/app/battles/results/${params.battleId}`);
      }, 3000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bot battle...</p>
        </div>
      </div>
    );
  }

  if (error || !battle) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-6 max-w-md">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Battle Not Found</h2>
          <p className="text-gray-600 mb-4">{error || "This battle doesn't exist or has ended."}</p>
          <Button onClick={() => router.push("/app/battles")}>
            Back to Battles
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BotBattleRoom battle={battle} onBattleEnd={handleBattleEnd} />
    </div>
  );
}
