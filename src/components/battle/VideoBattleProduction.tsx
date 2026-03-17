"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BattleLiveKitClient, LiveKitConfig } from "@/lib/livekit/client";

type ConnectionState = "connected" | "disconnected" | "reconnecting";

interface VideoBattleProductionProps {
  battleId: string;
  viewerUserId: string;
  localSlot: 1 | 2;
  onStreamReady?: (stream: MediaStream) => void;
}

export function VideoBattleProduction({
  battleId,
  viewerUserId,
  localSlot,
  onStreamReady,
}: VideoBattleProductionProps) {
  const client = useMemo(() => new BattleLiveKitClient(), []);

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [participantsCount, setParticipantsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tokenConfig, setTokenConfig] = useState<LiveKitConfig | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    client.setCallbacks({
      onParticipantsChanged(participants) {
        setParticipantsCount(participants.length);
      },
      onStateChanged(state) {
        setConnectionState(state);
      },
      onError(message) {
        setError(message);
      },
    });

    return () => {
      void client.disconnect();
    };
  }, [client]);

  useEffect(() => {
    client.setLocalVideoElement(localVideoRef.current);
    client.setRemoteVideoElement(remoteVideoRef.current);
  }, [client]);

  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      setError(null);
      const query = new URLSearchParams({
        room: battleId,
      });

      const response = await fetch(`/api/livekit/token?${query.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        if (!cancelled) {
          setTokenConfig(null);
          setError(payload?.details ?? payload?.error ?? "token_fetch_failed");
        }
        return;
      }

      if (!cancelled) {
        setTokenConfig({
          token: payload.token,
          url: payload.url,
        });
      }
    }

    void fetchToken();
    return () => {
      cancelled = true;
    };
  }, [battleId, viewerUserId]);

  async function fetchTokenConfig(): Promise<LiveKitConfig | null> {
    const query = new URLSearchParams({
      room: battleId,
    });

    const response = await fetch(`/api/livekit/token?${query.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.details ?? payload?.error ?? "token_fetch_failed");
      return null;
    }

    const config = {
      token: payload.token,
      url: payload.url,
    } satisfies LiveKitConfig;
    setTokenConfig(config);
    return config;
  }

  async function connectToRoom() {
    setIsConnecting(true);
    setError(null);
    const config = tokenConfig ?? (await fetchTokenConfig());
    if (!config) {
      setIsConnecting(false);
      return;
    }
    const ok = await client.connect(config);
    setIsConnecting(false);
    if (!ok) {
      setError("connect_failed");
    }
  }

  async function disconnectFromRoom() {
    await client.disableCamera();
    await client.disableMicrophone();
    await client.disconnect();
    setIsCameraEnabled(false);
    setIsMicEnabled(false);
  }

  async function toggleCamera() {
    if (isCameraEnabled) {
      await client.disableCamera();
      setIsCameraEnabled(false);
      return;
    }

    const enabled = await client.enableCamera();
    if (enabled) {
      setIsCameraEnabled(true);
      const stream = localVideoRef.current?.srcObject;
      if (stream instanceof MediaStream) {
        onStreamReady?.(stream);
      }
    }
  }

  async function toggleMicrophone() {
    if (isMicEnabled) {
      await client.disableMicrophone();
      setIsMicEnabled(false);
      return;
    }

    const enabled = await client.enableMicrophone();
    if (enabled) {
      setIsMicEnabled(true);
    }
  }

  const connected = connectionState === "connected";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="battle-video-production">
      <Card className="p-4 border-border/60 bg-card/40 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">Local (Slot {localSlot})</div>
          <Badge variant={connected ? "default" : "secondary"}>{connectionState}</Badge>
        </div>

        <div className="relative aspect-video rounded-lg bg-black overflow-hidden">
          <video
            ref={localVideoRef}
            className="h-full w-full object-cover battle-video"
            autoPlay
            muted
            playsInline
            data-testid="local-video"
          />

          {!isCameraEnabled ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-gray-300">Camera off</div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {!connected ? (
            <Button onClick={connectToRoom} disabled={isConnecting} data-testid="join-room">
              {isConnecting ? "Connecting..." : "Join Room"}
            </Button>
          ) : (
            <Button variant="destructive" onClick={disconnectFromRoom}>
              Leave Room
            </Button>
          )}

          <Button
            variant={isCameraEnabled ? "default" : "outline"}
            onClick={toggleCamera}
            disabled={!connected}
            data-testid="enable-camera"
          >
            {isCameraEnabled ? "Disable Camera" : "Enable Camera"}
          </Button>

          <Button
            variant={isMicEnabled ? "default" : "outline"}
            onClick={toggleMicrophone}
            disabled={!connected}
            data-testid="enable-mic"
          >
            {isMicEnabled ? "Disable Mic" : "Enable Mic"}
          </Button>
        </div>
      </Card>

      <Card className="p-4 border-border/60 bg-card/40 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">Remote</div>
          <Badge variant={participantsCount > 0 ? "default" : "secondary"}>
            {participantsCount > 0 ? "Connected" : "Waiting"}
          </Badge>
        </div>

        <div className="relative aspect-video rounded-lg bg-black overflow-hidden">
          <video
            ref={remoteVideoRef}
            className="h-full w-full object-cover battle-video"
            autoPlay
            playsInline
            data-testid="remote-video"
          />

          {participantsCount === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-gray-300">Waiting for opponent...</div>
          ) : null}
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          participants: <span className="font-mono text-foreground">{participantsCount + 1}</span>
        </div>

        {error ? <div className="mt-2 text-xs text-amber-200/90">{error}</div> : null}
      </Card>
    </div>
  );
}
