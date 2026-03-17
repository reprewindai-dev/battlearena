'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, Play, Pause, SkipForward, Trophy, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface BattleRoomProps {
  battleId: string;
  roomCode: string;
  isCreator: boolean;
  onLeave: () => void;
}

interface BattleParticipant {
  id: string;
  username: string;
  avatar?: string;
  tier: string;
  isReady: boolean;
  isRecording: boolean;
  audioLevel: number;
}

interface BattleState {
  status: 'waiting' | 'starting' | 'active' | 'round_active' | 'completed';
  currentRound: number;
  totalRounds: number;
  timeRemaining: number;
  roundTimeLimit: number;
  participants: BattleParticipant[];
  currentTurn?: string;
  beat?: {
    id: string;
    title: string;
    artist: string;
    tempo: number;
    previewUrl: string;
  };
}

export function BattleRoom({ battleId, roomCode, isCreator, onLeave }: BattleRoomProps) {
  const [battleState, setBattleState] = useState<BattleState>({
    status: 'waiting',
    currentRound: 1,
    totalRounds: 2,
    timeRemaining: 0,
    roundTimeLimit: 30,
    participants: [],
    beat: undefined
  });

  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const wsUrl = `ws://localhost:8080/v1/ws/battles/${battleId}?token=${localStorage.getItem('access_token')}`;
    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to battle room');
      ws.send(JSON.stringify({
        type: 'join_room',
        data: { room_code: roomCode }
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    ws.onclose = () => {
      console.log('Disconnected from battle room');
    };

    return () => {
      ws.close();
    };
  }, [battleId, roomCode]);

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'battle_update':
        setBattleState(prev => ({ ...prev, ...message.data }));
        break;
      case 'round_start':
        setBattleState(prev => ({ ...prev, status: 'round_active', currentTurn: message.data.participant_id }));
        if (message.data.participant_id === getCurrentUserId()) {
          startRecording();
        }
        break;
      case 'round_complete':
        setBattleState(prev => ({ ...prev, status: 'active' }));
        if (message.data.participant_id === getCurrentUserId()) {
          stopRecording();
        }
        break;
      case 'battle_complete':
        setBattleState(prev => ({ ...prev, status: 'completed' }));
        break;
      case 'participant_joined':
        setBattleState(prev => ({
          ...prev,
          participants: [...prev.participants, message.data.participant]
        }));
        break;
      case 'participant_left':
        setBattleState(prev => ({
          ...prev,
          participants: prev.participants.filter(p => p.id !== message.data.participant_id)
        }));
        break;
    }
  };

  const getCurrentUserId = () => {
    // Get current user ID from auth context or localStorage
    return localStorage.getItem('user_id') || '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        submitRecording(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Monitor audio levels
      monitorAudioLevel();
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current || !isRecording) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(average / 255);
    
    if (isRecording) {
      requestAnimationFrame(monitorAudioLevel);
    }
  };

  const submitRecording = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio_file', audioBlob);
      formData.append('round_number', battleState.currentRound.toString());
      formData.append('duration_seconds', '30');
      
      const response = await fetch(`/api/battles/${battleId}/rounds`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit recording');
      }
      
      toast.success('Recording submitted successfully');
    } catch (error) {
      console.error('Error submitting recording:', error);
      toast.error('Failed to submit recording');
    }
  };

  const startBattle = () => {
    if (!isCreator) return;
    
    websocketRef.current?.send(JSON.stringify({
      type: 'start_battle',
      data: {}
    }));
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-yellow-500';
      case 'starting': return 'bg-blue-500';
      case 'active': return 'bg-green-500';
      case 'round_active': return 'bg-red-500';
      case 'completed': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold">Battle Room</h1>
            <Badge variant="secondary" className="text-white bg-black/20">
              Room Code: {roomCode}
            </Badge>
            <Badge className={`${getStatusColor(battleState.status)} text-white`}>
              {battleState.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>{formatTime(battleState.timeRemaining)}</span>
            </div>
            <Button variant="outline" onClick={onLeave}>
              Leave Battle
            </Button>
          </div>
        </div>

        {/* Battle Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Participants */}
          <Card className="bg-black/20 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Participants</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {battleState.participants.map((participant) => (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                        <span className="text-sm font-bold">
                          {participant.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold">{participant.username}</p>
                        <Badge variant="outline" className="text-xs">
                          {participant.tier}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {participant.isRecording && (
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      )}
                      {participant.isReady && (
                        <Badge variant="default" className="text-xs bg-green-500">
                          Ready
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Battle Controls */}
          <Card className="bg-black/20 border-white/10">
            <CardHeader>
              <CardTitle>Battle Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-2xl font-bold mb-2">
                  Round {battleState.currentRound} of {battleState.totalRounds}
                </p>
                <Progress 
                  value={(battleState.currentRound / battleState.totalRounds) * 100} 
                  className="w-full mb-4"
                />
              </div>

              {battleState.beat && (
                <div className="p-4 rounded-lg bg-white/5">
                  <p className="font-semibold mb-2">Current Beat</p>
                  <p className="text-sm">{battleState.beat.title} - {battleState.beat.artist}</p>
                  <p className="text-xs text-gray-400">{battleState.beat.tempo} BPM</p>
                </div>
              )}

              {isCreator && battleState.status === 'waiting' && (
                <Button onClick={startBattle} className="w-full" size="lg">
                  <Play className="w-4 h-4 mr-2" />
                  Start Battle
                </Button>
              )}

              {battleState.status === 'completed' && (
                <div className="text-center">
                  <Trophy className="w-12 h-12 mx-auto mb-2 text-yellow-500" />
                  <p className="text-lg font-semibold">Battle Complete!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audio Controls */}
          <Card className="bg-black/20 border-white/10">
            <CardHeader>
              <CardTitle>Audio Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center space-x-4">
                <Button
                  variant={isRecording ? "destructive" : "default"}
                  size="lg"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={battleState.status !== 'round_active' || battleState.currentTurn !== getCurrentUserId()}
                >
                  {isRecording ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Start Recording
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  size="lg"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Audio Level Meter */}
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Audio Level</p>
                <div className="h-4 bg-black/30 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-green-500 to-yellow-500"
                    style={{ width: `${audioLevel * 100}%` }}
                    animate={{ width: `${audioLevel * 100}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
              </div>

              {battleState.status === 'round_active' && battleState.currentTurn === getCurrentUserId() && (
                <div className="text-center p-4 rounded-lg bg-red-500/20 border border-red-500/50">
                  <p className="text-red-400 font-semibold">Your Turn!</p>
                  <p className="text-sm">Start recording when ready</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Spectator Area */}
        {battleState.participants.length < 2 && (
          <Card className="bg-black/20 border-white/10">
            <CardContent className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-semibold mb-2">Waiting for Participants</p>
              <p className="text-gray-400">Share room code: {roomCode}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
