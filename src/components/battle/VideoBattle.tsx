"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type MediaStream = globalThis.MediaStream;

type VideoBattleProps = {
  localSlot: 1 | 2;
  mode: "mock" | "supabase";
  onStreamReady?: (stream: MediaStream) => void;
};

export function VideoBattle({ localSlot, mode, onStreamReady }: VideoBattleProps) {
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = React.useState<MediaStream | null>(null);
  const [isLocalVideoEnabled, setIsLocalVideoEnabled] = React.useState(true);
  const [isLocalAudioEnabled, setIsLocalAudioEnabled] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const localVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);

  // Initialize local media
  React.useEffect(() => {
    async function initLocalMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        onStreamReady?.(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        // Ensure audio plays through speakers (local video is muted, but audio routing is set)
        if (localVideoRef.current) {
          localVideoRef.current.muted = true; // Always mute local to avoid feedback
        }
      } catch (err) {
        setError("Camera/microphone access denied or unavailable.");
        console.error("Failed to get local media:", err);
      }
    }

    void initLocalMedia();

    return () => {
      // Cleanup will be handled by the effect that runs when localStream changes
    };
  }, [onStreamReady]);

  // Mock remote stream for demo purposes
  React.useEffect(() => {
    if (mode === "mock" && !remoteStream) {
      // Create a simple canvas-based mock video for testing
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Reduce flicker by drawing once and reusing the frame
        const drawFrame = () => {
          ctx.fillStyle = "#1a1a2e";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#eee";
          ctx.font = "24px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Opponent (Mock)", 320, 240);
        };
        drawFrame();
        
        // Capture at lower fps to reduce flicker
        const mockStream = canvas.captureStream(10);
        
        // Add mock audio track for testing
        try {
          const audioContext = new AudioContext();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          // Create a silent audio track (just for testing)
          const audioDestination = audioContext.createMediaStreamDestination();
          gainNode.connect(audioDestination);
          
          // Add audio track to mock video stream
          audioDestination.stream.getAudioTracks().forEach(track => {
            mockStream.addTrack(track);
          });
          
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1); // Brief tone
        } catch {
          // If audio fails, continue without mock audio
        }
        
        setRemoteStream(mockStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = mockStream;
          remoteVideoRef.current.muted = false; // Ensure remote audio plays
        }
      }
    }
  }, [mode, remoteStream]);

  // Toggle video/audio
  function toggleVideo() {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isLocalVideoEnabled;
        setIsLocalVideoEnabled(!isLocalVideoEnabled);
      }
    }
  }

  function toggleAudio() {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isLocalAudioEnabled;
        setIsLocalAudioEnabled(!isLocalAudioEnabled);
      }
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Local video */}
      <Card className="relative bg-black aspect-video">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover rounded-lg"
        />
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="text-xs">
            You (Slot {localSlot})
          </Badge>
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex gap-2">
          <Button
            size="sm"
            variant={isLocalVideoEnabled ? "default" : "destructive"}
            onClick={toggleVideo}
          >
            {isLocalVideoEnabled ? "Video On" : "Video Off"}
          </Button>
          <Button
            size="sm"
            variant={isLocalAudioEnabled ? "default" : "destructive"}
            onClick={toggleAudio}
          >
            {isLocalAudioEnabled ? "Mic On" : "Mic Off"}
          </Button>
        </div>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </Card>

      {/* Remote video */}
      <Card className="relative bg-black aspect-video">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover rounded-lg"
        />
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="text-xs">
            Opponent (Slot {localSlot === 1 ? 2 : 1})
          </Badge>
        </div>
        {!remoteStream && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
            <p className="text-gray-400 text-sm">Waiting for opponent...</p>
          </div>
        )}
      </Card>
    </div>
  );
}
