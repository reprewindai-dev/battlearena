import {
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalAudioTrack,
  LocalParticipant,
  LocalTrack,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";

export interface LiveKitConfig {
  url: string;
  token: string;
}

type ConnectionState = "connected" | "disconnected" | "reconnecting";

export class BattleLiveKitClient {
  private room: Room;
  private localVideoTrack?: LocalVideoTrack;
  private localAudioTrack?: LocalAudioTrack;
  private localVideoElement: HTMLVideoElement | null = null;
  private remoteVideoElement: HTMLVideoElement | null = null;
  private onParticipantsChanged?: (participants: RemoteParticipant[]) => void;
  private onStateChanged?: (state: ConnectionState) => void;
  private onError?: (message: string) => void;

  constructor() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: { width: 1280, height: 720 },
        frameRate: 30,
      },
    });

    this.setupEventListeners();
  }

  setLocalVideoElement(element: HTMLVideoElement | null) {
    this.localVideoElement = element;
  }

  setRemoteVideoElement(element: HTMLVideoElement | null) {
    this.remoteVideoElement = element;
  }

  private setupEventListeners() {
    this.room.on(RoomEvent.Connected, () => {
      this.onStateChanged?.("connected");
      this.notifyParticipantsChanged();
      this.attachFirstRemoteVideoTrack();
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.onStateChanged?.("disconnected");
      this.clearRemoteVideoElement();
    });

    this.room.on(RoomEvent.Reconnecting, () => {
      this.onStateChanged?.("reconnecting");
    });

    this.room.on(RoomEvent.ParticipantConnected, () => {
      this.notifyParticipantsChanged();
      this.attachFirstRemoteVideoTrack();
    });

    this.room.on(RoomEvent.ParticipantDisconnected, () => {
      this.notifyParticipantsChanged();
      this.attachFirstRemoteVideoTrack();
    });

    this.room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video) {
        this.attachRemoteTrack(track);
      }
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Video) {
        this.detachTrack(track);
      }
    });

    this.room.on(RoomEvent.MediaDevicesError, (error) => {
      this.onError?.(`media_devices_error:${error.message}`);
    });

    this.room.on(RoomEvent.ConnectionQualityChanged, () => {
      this.notifyParticipantsChanged();
    });
  }

  async connect(config: LiveKitConfig) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.room.connect(config.url, config.token);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown";
        if (attempt >= maxAttempts) {
          this.onError?.(`connect_failed:${message}`);
          return false;
        }

        const backoffMs = 250 * 2 ** (attempt - 1);
        this.onError?.(`connect_retry_${attempt}:${message}`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    return false;
  }

  async disconnect() {
    await this.unpublishAllLocalTracks();
    this.clearRemoteVideoElement();
    this.room.disconnect();
  }

  async enableCamera(): Promise<boolean> {
    try {
      if (!this.localVideoTrack) {
        this.localVideoTrack = await createLocalVideoTrack({
          facingMode: "user",
          frameRate: 30,
          resolution: { width: 1280, height: 720 },
        });
      }

      await this.publishTrack(this.localVideoTrack);
      this.attachLocalTrack(this.localVideoTrack);
      return true;
    } catch (error) {
      this.onError?.(`camera_enable_failed:${error instanceof Error ? error.message : "unknown"}`);
      return false;
    }
  }

  async disableCamera() {
    if (!this.localVideoTrack) return;

    await this.unpublishTrack(this.localVideoTrack);
    this.localVideoTrack.stop();
    this.localVideoTrack = undefined;

    if (this.localVideoElement) {
      this.localVideoElement.srcObject = null;
    }
  }

  async enableMicrophone(): Promise<boolean> {
    try {
      if (!this.localAudioTrack) {
        this.localAudioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
      }

      await this.publishTrack(this.localAudioTrack);
      return true;
    } catch (error) {
      this.onError?.(`mic_enable_failed:${error instanceof Error ? error.message : "unknown"}`);
      return false;
    }
  }

  async disableMicrophone() {
    if (!this.localAudioTrack) return;

    await this.unpublishTrack(this.localAudioTrack);
    this.localAudioTrack.stop();
    this.localAudioTrack = undefined;
  }

  private async publishTrack(track: LocalTrack) {
    const localParticipant = this.room.localParticipant as LocalParticipant;
    const publication = localParticipant.getTrackPublication(track.source);
    if (publication) return;
    await localParticipant.publishTrack(track);
  }

  private async unpublishTrack(track: LocalTrack) {
    const localParticipant = this.room.localParticipant as LocalParticipant;
    await localParticipant.unpublishTrack(track);
  }

  private async unpublishAllLocalTracks() {
    if (this.localAudioTrack) {
      await this.unpublishTrack(this.localAudioTrack);
      this.localAudioTrack.stop();
      this.localAudioTrack = undefined;
    }

    if (this.localVideoTrack) {
      await this.unpublishTrack(this.localVideoTrack);
      this.localVideoTrack.stop();
      this.localVideoTrack = undefined;
    }

    if (this.localVideoElement) {
      this.localVideoElement.srcObject = null;
    }
  }

  private attachLocalTrack(track: LocalVideoTrack) {
    if (!this.localVideoElement) return;
    this.localVideoElement.srcObject = null;
    track.attach(this.localVideoElement);
    this.localVideoElement.muted = true;
    this.localVideoElement.autoplay = true;
    this.localVideoElement.playsInline = true;
  }

  private attachRemoteTrack(track: RemoteTrack) {
    if (!this.remoteVideoElement) return;
    this.remoteVideoElement.srcObject = null;
    track.attach(this.remoteVideoElement);
    this.remoteVideoElement.autoplay = true;
    this.remoteVideoElement.playsInline = true;
  }

  private attachFirstRemoteVideoTrack() {
    for (const participant of this.room.remoteParticipants.values()) {
      const publication = Array.from(participant.trackPublications.values()).find(
        (p: RemoteTrackPublication) => p.kind === Track.Kind.Video && p.track,
      );

      if (publication?.track) {
        this.attachRemoteTrack(publication.track as RemoteTrack);
        return;
      }
    }

    this.clearRemoteVideoElement();
  }

  private clearRemoteVideoElement() {
    if (this.remoteVideoElement) {
      for (const participant of this.room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          if (publication.track?.kind === Track.Kind.Video) {
            publication.track.detach(this.remoteVideoElement);
          }
        }
      }
      this.remoteVideoElement.srcObject = null;
    }
  }

  private detachTrack(track: RemoteTrack) {
    track.detach();
    this.attachFirstRemoteVideoTrack();
  }

  private notifyParticipantsChanged() {
    const participants = Array.from(this.room.remoteParticipants.values());
    this.onParticipantsChanged?.(participants);
  }

  getParticipants(): RemoteParticipant[] {
    return Array.from(this.room.remoteParticipants.values());
  }

  isConnected(): boolean {
    return this.room.state === "connected";
  }

  setCallbacks(callbacks: {
    onParticipantsChanged?: (participants: RemoteParticipant[]) => void;
    onStateChanged?: (state: ConnectionState) => void;
    onError?: (message: string) => void;
  }) {
    this.onParticipantsChanged = callbacks.onParticipantsChanged;
    this.onStateChanged = callbacks.onStateChanged;
    this.onError = callbacks.onError;
  }
}
