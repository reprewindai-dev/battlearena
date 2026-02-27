"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BattleLiveKitClient, LiveKitConfig } from '@/lib/livekit/client';

interface LiveBattleRoomProps {
  roomId: string;
  participantId: string;
  onBattleEnd?: () => void;
}

export function LiveBattleRoom({ roomId, participantId, onBattleEnd }: LiveBattleRoomProps) {
  const [liveKitClient] = useState(() => new BattleLiveKitClient());
  const [isConnected, setIsConnected] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [token, setToken] = useState<string>('');
  const [battleStatus, setBattleStatus] = useState<'waiting' | 'active' | 'ended'>('waiting');

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get LiveKit token for this room
    fetchToken();
  }, [roomId, participantId]);

  useEffect(() => {
    // Setup LiveKit client callbacks
    liveKitClient.setCallbacks({
      onParticipantsChanged: setParticipants,
      onStateChanged: setConnectionState
    });

    return () => {
      liveKitClient.disconnect();
    };
  }, [liveKitClient]);

  const fetchToken = async () => {
    try {
      const response = await fetch(`/api/livekit/token?room=${roomId}&participant=${participantId}`);
      const data = await response.json();
      setToken(data.token);
    } catch (error) {
      console.error('Failed to fetch LiveKit token:', error);
    }
  };

  const connectToRoom = async () => {
    if (!token) return;

    const config: LiveKitConfig = {
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880',
      token
    };

    const connected = await liveKitClient.connect(config);
    if (connected) {
      setIsConnected(true);
      setBattleStatus('active');
    }
  };

  const disconnectFromRoom = async () => {
    await liveKitClient.disconnect();
    setIsConnected(false);
    setBattleStatus('ended');
    onBattleEnd?.();
  };

  const toggleCamera = async () => {
    if (isCameraEnabled) {
      await liveKitClient.disableCamera();
      setIsCameraEnabled(false);
    } else {
      const enabled = await liveKitClient.enableCamera();
      if (enabled) {
        setIsCameraEnabled(true);
      }
    }
  };

  const toggleMicrophone = async () => {
    if (isMicEnabled) {
      await liveKitClient.disableMicrophone();
      setIsMicEnabled(false);
    } else {
      const enabled = await liveKitClient.enableMicrophone();
      if (enabled) {
        setIsMicEnabled(true);
      }
    }
  };

  const getConnectionColor = () => {
    switch (connectionState) {
      case 'connected': return 'bg-green-500';
      case 'reconnecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Local Video */}
      <Card className="relative">
        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
          <div 
            ref={localVideoRef}
            id="local-video"
            className="w-full h-full"
          />
          {!isCameraEnabled && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-gray-400">Camera Off</p>
              </div>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">You</h3>
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {connectionState}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant={isCameraEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={toggleCamera}
                disabled={!isConnected}
              >
                {isCameraEnabled ? 'Camera On' : 'Camera Off'}
              </Button>
              <Button
                variant={isMicEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={toggleMicrophone}
                disabled={!isConnected}
              >
                {isMicEnabled ? 'Mic On' : 'Mic Off'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Remote Video */}
      <Card className="relative">
        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
          <div 
            ref={remoteVideoRef}
            id="remote-video"
            className="w-full h-full"
          />
          {participants.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p className="text-gray-400">Waiting for opponent...</p>
              </div>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Opponent</h3>
              <Badge variant={participants.length > 0 ? 'default' : 'secondary'}>
                {participants.length > 0 ? 'Connected' : 'Waiting'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getConnectionColor()}`} />
              <span className="text-sm text-gray-600">{battleStatus}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Battle Controls */}
      <Card className="lg:col-span-2">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Battle Room: {roomId}</h2>
              <p className="text-gray-600">Live streaming with {participants.length + 1} participants</p>
            </div>
            <div className="flex gap-2">
              {!isConnected ? (
                <Button onClick={connectToRoom} disabled={!token}>
                  Join Battle
                </Button>
              ) : (
                <Button variant="destructive" onClick={disconnectFromRoom}>
                  Leave Battle
                </Button>
              )}
            </div>
          </div>
          
          {/* Connection Status */}
          <div className="mt-4 p-3 bg-gray-100 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connection Status:</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getConnectionColor()}`} />
                <span className="text-sm">{connectionState}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
