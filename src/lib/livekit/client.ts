import { Room, RoomEvent, RemoteParticipant, RemoteTrack, Track, LocalVideoTrack, LocalAudioTrack } from 'livekit-client';

export interface LiveKitConfig {
  url: string;
  token: string;
}

export class BattleLiveKitClient {
  private room: Room;
  private localVideoTrack?: LocalVideoTrack;
  private localAudioTrack?: LocalAudioTrack;
  private onParticipantsChanged?: (participants: RemoteParticipant[]) => void;
  private onStateChanged?: (state: 'connected' | 'disconnected' | 'reconnecting') => void;

  constructor() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        width: 1280,
        height: 720,
        frameRate: 30
      }
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.room.on(RoomEvent.Connected, () => {
      console.log('🔥 LiveKit Connected');
      this.onStateChanged?.('connected');
    });

    this.room.on(RoomEvent.Disconnected, () => {
      console.log('🔥 LiveKit Disconnected');
      this.onStateChanged?.('disconnected');
    });

    this.room.on(RoomEvent.Reconnecting, () => {
      console.log('🔥 LiveKit Reconnecting');
      this.onStateChanged?.('reconnecting');
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('🔥 Participant connected:', participant.identity);
      this.notifyParticipantsChanged();
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('🔥 Participant disconnected:', participant.identity);
      this.notifyParticipantsChanged();
    });

    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('🔥 Track subscribed:', track.kind, participant.identity);
      this.attachTrack(track, participant);
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('🔥 Track unsubscribed:', track.kind, participant.identity);
      this.detachTrack(track);
    });
  }

  async connect(config: LiveKitConfig) {
    try {
      await this.room.connect(config.url, config.token);
      return true;
    } catch (error) {
      console.error('Failed to connect to LiveKit:', error);
      return false;
    }
  }

  async disconnect() {
    await this.room.disconnect();
  }

  async enableCamera(): Promise<boolean> {
    try {
      if (!this.localVideoTrack) {
        this.localVideoTrack = await Room.createLocalVideoTrack({
          camera: 'user',
          resolution: { width: 1280, height: 720, frameRate: 30 }
        });
      }
      
      await this.room.localParticipant.publishTrack(this.localVideoTrack);
      return true;
    } catch (error) {
      console.error('Failed to enable camera:', error);
      return false;
    }
  }

  async disableCamera() {
    if (this.localVideoTrack) {
      await this.room.localParticipant.unpublishTrack(this.localVideoTrack);
      this.localVideoTrack.stop();
      this.localVideoTrack = undefined;
    }
  }

  async enableMicrophone(): Promise<boolean> {
    try {
      if (!this.localAudioTrack) {
        this.localAudioTrack = await Room.createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        });
      }
      
      await this.room.localParticipant.publishTrack(this.localAudioTrack);
      return true;
    } catch (error) {
      console.error('Failed to enable microphone:', error);
      return false;
    }
  }

  async disableMicrophone() {
    if (this.localAudioTrack) {
      await this.room.localParticipant.unpublishTrack(this.localAudioTrack);
      this.localAudioTrack.stop();
      this.localAudioTrack = undefined;
    }
  }

  private attachTrack(track: RemoteTrack, participant: RemoteParticipant) {
    const element = track.attach();
    const container = document.getElementById(`participant-${participant.identity}-${track.kind}`);
    
    if (container) {
      container.innerHTML = '';
      container.appendChild(element);
    }
  }

  private detachTrack(track: RemoteTrack) {
    track.detach();
  }

  private notifyParticipantsChanged() {
    const participants = Array.from(this.room.remoteParticipants.values());
    this.onParticipantsChanged?.(participants);
  }

  getParticipants(): RemoteParticipant[] {
    return Array.from(this.room.remoteParticipants.values());
  }

  isConnected(): boolean {
    return this.room.state === 'connected';
  }

  setCallbacks(callbacks: {
    onParticipantsChanged?: (participants: RemoteParticipant[]) => void;
    onStateChanged?: (state: 'connected' | 'disconnected' | 'reconnecting') => void;
  }) {
    this.onParticipantsChanged = callbacks.onParticipantsChanged;
    this.onStateChanged = callbacks.onStateChanged;
  }
}
