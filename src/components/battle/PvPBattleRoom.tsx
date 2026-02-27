"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OpponentProfile } from "@/lib/pvp/OpponentOrchestrator";

interface PvPBattleRoomProps {
  match: {
    matchId: string;
    opponent: OpponentProfile;
    opponentType: 'live' | 'ghost' | 'bot';
    timing: any;
  };
  onBattleEnd: (result: any) => void;
}

export function PvPBattleRoom({ match, onBattleEnd }: PvPBattleRoomProps) {
  const [currentRound, setCurrentRound] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [userTurn, setUserTurn] = useState(true);
  const [userScore, setUserScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [opponentAction, setOpponentAction] = useState<string>("");
  const [tensionLevel, setTensionLevel] = useState(0.5);
  const [showMomentum, setShowMomentum] = useState(false);
  
  const actionTimeoutRef = useRef<NodeJS.Timeout>();
  const opponent = match.opponent;

  useEffect(() => {
    // Start battle with opponent intro
    const intro = generateOpponentIntro();
    setBattleLog([`${opponent.name}: ${intro}`]);
    
    return () => {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
      }
    };
  }, []);

  const generateOpponentIntro = () => {
    const intros = [
      "Let's see what you've got!",
      "Ready to battle?",
      "Time to shine!",
      "May the best MC win!",
      "Let's go!"
    ];
    return intros[Math.floor(Math.random() * intros.length)];
  };

  const handleUserRecording = () => {
    if (!userTurn) return;
    
    setIsRecording(true);
    setUserTurn(false);
    
    // Simulate user recording for 60 seconds
    setTimeout(() => {
      setIsRecording(false);
      handleUserTurnComplete();
    }, 60000);
  };

  const handleUserTurnComplete = () => {
    // Simulate user rap
    const userLine = generateUserLine();
    setBattleLog(prev => [...prev, `You: ${userLine}`]);
    
    // Calculate tension based on score difference
    const scoreDiff = Math.abs(userScore - opponentScore);
    const newTension = Math.min(1, scoreDiff / 100);
    setTensionLevel(newTension);
    
    if (newTension > 0.7) {
      setShowMomentum(true);
    }
    
    // Generate opponent response with human-like delay
    const reactionDelay = calculateOpponentReactionDelay();
    
    actionTimeoutRef.current = setTimeout(() => {
      generateOpponentResponse(userLine);
    }, reactionDelay);
  };

  const calculateOpponentReactionDelay = () => {
    // Base delay varies by persona
    const personaDelays = {
      aggressive: 200 + Math.random() * 300, // 200-500ms
      turtle: 400 + Math.random() * 400, // 400-800ms
      counterpunch: 250 + Math.random() * 350, // 250-600ms
      gambler: 300 + Math.random() * 400, // 300-700ms
      clipper_hunter: 350 + Math.random() * 300 // 350-650ms
    };
    
    let baseDelay = personaDelays[opponent.persona] || 400;
    
    // Add hesitation under pressure
    if (tensionLevel > 0.7 && Math.random() < 0.3) {
      baseDelay += 200 + Math.random() * 400; // Hesitation spike
    }
    
    // Add input jitter
    const jitter = (Math.random() - 0.5) * 50; // +/-25ms
    
    return Math.max(150, baseDelay + jitter);
  };

  const generateOpponentResponse = (userLine: string) => {
    // Apply drama curve and humanization
    const response = generateContextualResponse(userLine);
    setOpponentAction(response);
    
    setBattleLog(prev => [...prev, `${opponent.name}: ${response}`]);
    
    // Simulate scoring with drama curve influence
    const roundResult = calculateRoundResult();
    
    const userRoundScore = roundResult.userScore;
    const opponentRoundScore = roundResult.opponentScore;
    
    setUserScore(prev => prev + userRoundScore);
    setOpponentScore(prev => prev + opponentRoundScore);
    
    setBattleLog(prev => [...prev, 
      `Round ${currentRound} Scores: You ${userRoundScore} - ${opponent.name} ${opponentRoundScore}`
    ]);
    
    // Check if battle is over
    if (currentRound >= 3) {
      endBattle();
    } else {
      setCurrentRound(prev => prev + 1);
      setUserTurn(true);
      setOpponentAction("");
    }
  };

  const generateContextualResponse = (userLine: string): string => {
    // Generate responses based on persona and game state
    const responses = {
      aggressive: [
        "You're not ready for this level!",
        "That was weak! Try harder!",
        "I'm just getting warmed up!",
        "Is that all you've got?"
      ],
      turtle: [
        "Interesting approach...",
        "Let me think about that...",
        "Solid move, but not enough.",
        "Patience is key in battles."
      ],
      counterpunch: [
        "Nice try, but I saw that coming.",
        "Predictable. Here's my response.",
        "You're telegraphing your moves.",
        "Adapt or lose."
      ],
      gambler: [
        "Let's raise the stakes!",
        "Risk it for the biscuit!",
        "Go big or go home!",
        "Time to get crazy!"
      ],
      clipper_hunter: [
        "Technique over everything.",
        "Precision beats power.",
        "Watch the timing on this.",
        "Clean execution wins."
      ]
    };
    
    const personaResponses = responses[opponent.persona] || responses.aggressive;
    
    // Add pressure responses
    if (tensionLevel > 0.8) {
      const pressureResponses = [
        "This is getting intense!",
        "No turning back now!",
        "It all comes down to this!",
        "Heart is pumping!"
      ];
      return pressureResponses[Math.floor(Math.random() * pressureResponses.length)];
    }
    
    return personaResponses[Math.floor(Math.random() * personaResponses.length)];
  };

  const calculateRoundResult = () => {
    // Apply drama curve to create tension
    const scoreDiff = opponentScore - userScore;
    const roundNumber = currentRound;
    
    let userScore = 60 + Math.random() * 30; // 60-90 base
    let opponentScore = 60 + Math.random() * 30; // 60-90 base
    
    // Apply drama curve adjustments
    if (roundNumber === 3 && Math.abs(scoreDiff) < 20) {
      // Final round, close match - add drama
      if (scoreDiff > 0) {
        // Opponent is winning, give user a boost
        userScore += 10;
      } else {
        // User is winning, give opponent a boost
        opponentScore += 10;
      }
    }
    
    // Apply persona-based adjustments
    if (opponent.persona === 'aggressive') {
      opponentScore += 5;
    } else if (opponent.persona === 'turtle') {
      userScore += 3;
    }
    
    // Add mistakes under pressure
    if (tensionLevel > 0.7 && Math.random() < 0.2) {
      // Someone makes a mistake
      if (Math.random() < 0.5) {
        opponentScore -= 10;
      } else {
        userScore -= 10;
      }
    }
    
    return {
      userScore: Math.max(0, Math.min(100, userScore)),
      opponentScore: Math.max(0, Math.min(100, opponentScore))
    };
  };

  const generateUserLine = () => {
    const lines = [
      "Check the mic, one two, this is my time to shine!",
      "Coming through with lyrics that blow your mind!",
      "Step to the plate and I'm knocking it out the park!",
      "Flow so cold, I need to wear a heavy coat!",
      "Every bar I drop is a masterpiece in the making!"
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  };

  const endBattle = () => {
    const winner = userScore > opponentScore ? "user" : "opponent";
    const isCloseMatch = Math.abs(userScore - opponentScore) < 30;
    
    let message = "";
    if (winner === "user") {
      message = isCloseMatch ? "That was intense! Great battle!" : "Dominant performance!";
    } else {
      message = isCloseMatch ? "So close! You'll get me next time!" : "Better luck next time!";
    }
    
    setBattleLog(prev => [...prev, 
      `${opponent.name}: ${message}`,
      `Battle Over! Final Score: You ${userScore} - ${opponent.name} ${opponentScore}`,
      `Winner: ${winner === "user" ? "You!" : opponent.name}`,
      `${isCloseMatch ? "🔥 Close Match!" : ""}`
    ]);
    
    onBattleEnd({
      winner,
      userScore,
      opponentScore,
      isCloseMatch,
      opponentType: match.opponentType,
      matchId: match.matchId
    });
  };

  const getOpponentTypeLabel = () => {
    if (match.opponentType === 'live') return "Live Opponent";
    if (match.opponentType === 'ghost') return "Challenger";
    return "Rival";
  };

  const getOpponentTypeColor = () => {
    if (match.opponentType === 'live') return "text-green-600";
    if (match.opponentType === 'ghost') return "text-blue-600";
    return "text-purple-600";
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">PvP Battle</h1>
        <div className="flex items-center gap-4">
          <Badge variant="outline">Round {currentRound}/3</Badge>
          <Badge variant="outline">{getOpponentTypeLabel()}</Badge>
          <Badge variant="outline">Format: 60s</Badge>
          {showMomentum && <Badge className="bg-orange-500">Momentum Shift!</Badge>}
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
            {tensionLevel > 0.7 && (
              <div className="text-xs text-orange-500 mt-1 animate-pulse">
                High Tension!
              </div>
            )}
          </div>
        </Card>

        {/* Opponent Card */}
        <Card className="p-4">
          <div className="text-center">
            <Avatar className="h-12 w-12 mx-auto mb-2">
              <AvatarImage src={opponent.avatar} />
              <AvatarFallback>{opponent.name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <h3 className="font-semibold">{opponent.name}</h3>
            <div className={`text-xs ${getOpponentTypeColor()} mb-1`}>
              {opponent.rank}
            </div>
            <div className="text-2xl font-bold text-red-600">{opponentScore}</div>
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
              <h3 className="text-lg font-semibold mb-4">{opponent.name} is responding...</h3>
              <div className="animate-pulse">
                <Avatar className="h-16 w-16 mx-auto mb-2">
                  <AvatarImage src={opponent.avatar} />
                  <AvatarFallback>{opponent.name[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <p className="text-gray-600">Opponent is preparing their response...</p>
                {opponentAction && (
                  <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
                    <em>"{opponentAction}"</em>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Opponent Info */}
      <Card className="p-4 mt-6">
        <h3 className="font-semibold mb-2">Opponent Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Style:</span>
            <div className="capitalize">{opponent.persona.replace('_', ' ')}</div>
          </div>
          <div>
            <span className="text-gray-600">MMR:</span>
            <div>{opponent.mmr}</div>
          </div>
          <div>
            <span className="text-gray-600">Win Rate:</span>
            <div>{Math.round(opponent.winRate * 100)}%</div>
          </div>
          <div>
            <span className="text-gray-600">Streak:</span>
            <div>{opponent.streak > 0 ? '+' : ''}{opponent.streak}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
