"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BotOpponent } from "@/lib/ai/bot-opponent";

interface BotBattleRoomProps {
  battle: any;
  onBattleEnd: (winner: string, scores: any) => void;
}

export function BotBattleRoom({ battle, onBattleEnd }: BotBattleRoomProps) {
  const [currentRound, setCurrentRound] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [userTurn, setUserTurn] = useState(true);
  const [botResponse, setBotResponse] = useState("");
  const [userScore, setUserScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  
  const botOpponent = new BotOpponent(battle.bot_personality_id, battle.beat);

  useEffect(() => {
    // Start battle with bot intro
    const intro = botOpponent.generateIntro();
    setBattleLog([`${botOpponent.getPersonality().name}: ${intro}`]);
  }, []);

  const handleUserRecording = () => {
    if (!userTurn) return;
    
    setIsRecording(true);
    // Simulate user recording for 60 seconds
    setTimeout(() => {
      setIsRecording(false);
      handleUserTurnComplete();
    }, 60000);
  };

  const handleUserTurnComplete = () => {
    // Simulate user rap (in real app, this would be audio processing)
    const userLine = "User's awesome rap line here!";
    setBattleLog(prev => [...prev, `You: ${userLine}`]);
    
    // Generate bot response
    setTimeout(() => {
      const botLine = botOpponent.generateResponse(userLine);
      setBotResponse(botLine);
      setBattleLog(prev => [...prev, `${botOpponent.getPersonality().name}: ${botLine}`]);
      
      // Simulate scoring
      const userRoundScore = Math.floor(Math.random() * 40) + 60; // 60-100
      const botRoundScore = Math.floor(Math.random() * 40) + 60; // 60-100
      
      setUserScore(prev => prev + userRoundScore);
      setBotScore(prev => prev + botRoundScore);
      
      setBattleLog(prev => [...prev, 
        `Round ${currentRound} Scores: You ${userRoundScore} - ${botOpponent.getPersonality().name} ${botRoundScore}`
      ]);
      
      // Check if battle is over
      if (currentRound >= 3) {
        endBattle();
      } else {
        setCurrentRound(prev => prev + 1);
        setUserTurn(true);
        setBotResponse("");
      }
    }, 2000);
  };

  const endBattle = () => {
    const winner = userScore > botScore ? "user" : "bot";
    const message = winner === "user" 
      ? botOpponent.generateDefeatMessage()
      : botOpponent.generateVictoryMessage();
    
    setBattleLog(prev => [...prev, 
      `${botOpponent.getPersonality().name}: ${message}`,
      `Battle Over! Final Score: You ${userScore} - ${botOpponent.getPersonality().name} ${botScore}`,
      `Winner: ${winner === "user" ? "You!" : botOpponent.getPersonality().name}`
    ]);
    
    onBattleEnd(winner, { userScore, botScore });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Bot Battle</h1>
        <div className="flex items-center gap-4">
          <Badge variant="outline">Round {currentRound}/3</Badge>
          <Badge variant="outline">Format: {battle.battle_format}</Badge>
          <Badge variant="outline">Difficulty: {battle.bot_difficulty}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* User Card */}
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl mb-2">🎤</div>
            <h3 className="font-semibold">You</h3>
            <div className="text-2xl font-bold text-blue-600">{userScore}</div>
            <div className="text-sm text-gray-600">Score</div>
          </div>
        </Card>

        {/* VS */}
        <Card className="p-4 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-400">VS</div>
            <div className="text-sm text-gray-600 mt-2">Round {currentRound}</div>
          </div>
        </Card>

        {/* Bot Card */}
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl mb-2">{botOpponent.getPersonality().avatar}</div>
            <h3 className="font-semibold">{botOpponent.getPersonality().name}</h3>
            <div className="text-2xl font-bold text-red-600">{botScore}</div>
            <div className="text-sm text-gray-600">Score</div>
          </div>
        </Card>
      </div>

      {/* Battle Log */}
      <Card className="p-4 mb-6">
        <h3 className="font-semibold mb-3">Battle Log</h3>
        <div className="bg-gray-50 rounded p-3 h-48 overflow-y-auto">
          {battleLog.map((log, index) => (
            <div key={index} className="mb-2 text-sm">
              {log}
            </div>
          ))}
        </div>
      </Card>

      {/* Action Area */}
      <Card className="p-6">
        <div className="text-center">
          {userTurn ? (
            <div>
              <h3 className="text-lg font-semibold mb-4">Your Turn - Drop your bars!</h3>
              <Button 
                onClick={handleUserRecording}
                disabled={isRecording}
                size="lg"
                className="mb-4"
              >
                {isRecording ? "🔴 Recording..." : "🎤 Start Recording"}
              </Button>
              <p className="text-sm text-gray-600">
                {isRecording ? "Keep flowing! You've got 60 seconds!" : "Click to start your 60-second rap"}
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold mb-4">{botOpponent.getPersonality().name} is thinking...</h3>
              <div className="animate-pulse">
                <div className="text-2xl mb-2">{botOpponent.getPersonality().avatar}</div>
                <p className="text-gray-600">Bot is preparing their response...</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Beat Info */}
      {battle.beat && (
        <Card className="p-4 mt-6">
          <h3 className="font-semibold mb-2">Current Beat</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{battle.beat.title}</p>
              <p className="text-sm text-gray-600">{battle.beat.artist} • {battle.beat.tempo} BPM • {battle.beat.genre}</p>
            </div>
            <Button variant="outline" size="sm">
              🎵 Play Beat
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
