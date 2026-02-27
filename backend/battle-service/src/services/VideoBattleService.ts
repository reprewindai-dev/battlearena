import { AccessToken } from 'livekit-server-sdk';
import { logger } from '../utils/logger';

interface VideoBattleRoom {
  id: string;
  name: string;
  battleId: string;
  participantAId?: string;
  participantBId?: string;
  status: 'waiting' | 'active' | 'recording' | 'completed';
  createdAt: Date;
  expiresAt: Date;
}

interface VideoParticipant {
  id: string;
  userId: string;
  roomId: string;
  name: string;
  role: 'participant' | 'judge' | 'spectator';
  joinedAt: Date;
  isRecording: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
}

class VideoBattleService {
  private livekitHost: string;
  private apiKey: string;
  private apiSecret: string;
  private activeRooms: Map<string, VideoBattleRoom> = new Map();
  private participants: Map<string, VideoParticipant> = new Map();

  constructor() {
    this.livekitHost = process.env.LIVEKIT_HOST || 'http://localhost:7880';
    this.apiKey = process.env.LIVEKIT_API_KEY || '';
    this.apiSecret = process.env.LIVEKIT_API_SECRET || '';
  }

  async createBattleRoom(battleId: string, participantAId: string, participantBId: string): Promise<VideoBattleRoom> {
    try {
      const roomId = `battle-${battleId}-${Date.now()}`;
      const roomName = `Battle Room - ${battleId}`;

      // Create room via LiveKit REST API
      const response = await fetch(`${this.livekitHost}/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}:${this.apiSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: roomName,
          emptyTimeout: 300,
          maxParticipants: 10,
          recordingEnabled: true,
          transcriptionEnabled: false
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create room: ${response.statusText}`);
      }

      const roomData = await response.json();

      const videoRoom: VideoBattleRoom = {
        id: roomData.sid || roomId,
        name: roomName,
        battleId,
        participantAId,
        participantBId,
        status: 'waiting',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      this.activeRooms.set(videoRoom.id, videoRoom);

      logger.info(`Created video battle room: ${videoRoom.id} for battle ${battleId}`);
      
      return videoRoom;

    } catch (error) {
      logger.error('Failed to create battle room:', error);
      throw new Error('Failed to create video battle room');
    }
  }

  async generateParticipantToken(roomId: string, userId: string, name: string, role: 'participant' | 'judge' | 'spectator'): Promise<string> {
    try {
      const token = new AccessToken(this.apiKey, this.apiSecret, {
        identity: userId,
        name: name,
        metadata: JSON.stringify({
          role,
          userId,
          joinedAt: new Date().toISOString()
        })
      });

      token.addGrant({
        roomJoin: true,
        room: roomId,
        canPublish: role === 'participant',
        canSubscribe: true,
        canPublishData: true,
      });

      if (role === 'participant') {
        token.addGrant({
          roomRecord: true,
        });
      }

      const jwt = await token.toJwt();

      // Track participant
      const videoParticipant: VideoParticipant = {
        id: userId,
        userId,
        roomId,
        name,
        role,
        joinedAt: new Date(),
        isRecording: role === 'participant',
        hasVideo: role === 'participant',
        hasAudio: role === 'participant'
      };

      this.participants.set(userId, videoParticipant);

      logger.info(`Generated participant token for ${userId} in room ${roomId} as ${role}`);

      return jwt;

    } catch (error) {
      logger.error('Failed to generate participant token:', error);
      throw new Error('Failed to generate participant token');
    }
  }

  async startRecording(roomId: string): Promise<void> {
    try {
      const room = this.activeRooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Start recording via LiveKit API
      const response = await fetch(`${this.livekitHost}/rooms/${roomId}/recording`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}:${this.apiSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: true
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to start recording: ${response.statusText}`);
      }

      room.status = 'recording';

      logger.info(`Started recording for room ${roomId}`);

    } catch (error) {
      logger.error('Failed to start recording:', error);
      throw new Error('Failed to start recording');
    }
  }

  async stopRecording(roomId: string): Promise<string> {
    try {
      const room = this.activeRooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Stop recording via LiveKit API
      const response = await fetch(`${this.livekitHost}/rooms/${roomId}/recording`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}:${this.apiSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: false
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to stop recording: ${response.statusText}`);
      }

      room.status = 'completed';

      // In a real implementation, you would get the recording URL from LiveKit
      const recordingUrl = `https://storage.googleapis.com/arena-recordings/${roomId}.mp4`;

      logger.info(`Stopped recording for room ${roomId}. Recording available at: ${recordingUrl}`);

      return recordingUrl;

    } catch (error) {
      logger.error('Failed to stop recording:', error);
      throw new Error('Failed to stop recording');
    }
  }

  async getRoomParticipants(roomId: string): Promise<VideoParticipant[]> {
    try {
      const response = await fetch(`${this.livekitHost}/rooms/${roomId}/participants`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}:${this.apiSecret}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get participants: ${response.statusText}`);
      }

      const participants = await response.json();
      
      return participants.map((p: any) => ({
        id: p.identity,
        userId: p.identity,
        roomId,
        name: p.name,
        role: JSON.parse(p.metadata || '{}').role || 'spectator',
        joinedAt: new Date(p.joinedAt),
        isRecording: p.canPublish,
        hasVideo: p.canPublish,
        hasAudio: p.canPublish
      }));

    } catch (error) {
      logger.error('Failed to get room participants:', error);
      return [];
    }
  }

  async endBattleRoom(roomId: string): Promise<void> {
    try {
      const room = this.activeRooms.get(roomId);
      if (!room) {
        return;
      }

      // Stop recording if active
      if (room.status === 'recording') {
        await this.stopRecording(roomId);
      }

      // Delete room
      const response = await fetch(`${this.livekitHost}/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}:${this.apiSecret}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete room: ${response.statusText}`);
      }

      // Clean up local tracking
      this.activeRooms.delete(roomId);
      
      // Remove participants
      for (const [participantId, participant] of this.participants) {
        if (participant.roomId === roomId) {
          this.participants.delete(participantId);
        }
      }

      logger.info(`Ended battle room: ${roomId}`);

    } catch (error) {
      logger.error('Failed to end battle room:', error);
      throw new Error('Failed to end battle room');
    }
  }

  async getRecordingStatus(roomId: string): Promise<{ status: string; url?: string; duration?: number }> {
    try {
      const room = this.activeRooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      return {
        status: room.status,
        url: room.status === 'completed' ? `https://storage.googleapis.com/arena-recordings/${roomId}.mp4` : undefined,
        duration: room.status === 'completed' ? 180 : undefined
      };

    } catch (error) {
      logger.error('Failed to get recording status:', error);
      throw new Error('Failed to get recording status');
    }
  }

  async validateParticipantAccess(userId: string, roomId: string, role: string): Promise<boolean> {
    try {
      const room = this.activeRooms.get(roomId);
      if (!room) {
        return false;
      }

      // Check if user is authorized for this room
      if (role === 'participant') {
        return userId === room.participantAId || userId === room.participantBId;
      }

      // Judges and spectators can join any room
      return role === 'judge' || role === 'spectator';

    } catch (error) {
      logger.error('Failed to validate participant access:', error);
      return false;
    }
  }

  async updateParticipantMedia(userId: string, roomId: string, hasVideo: boolean, hasAudio: boolean): Promise<void> {
    try {
      const participant = this.participants.get(userId);
      if (!participant || participant.roomId !== roomId) {
        throw new Error('Participant not found in room');
      }

      participant.hasVideo = hasVideo;
      participant.hasAudio = hasAudio;

      logger.info(`Updated media for participant ${userId}: video=${hasVideo}, audio=${hasAudio}`);

    } catch (error) {
      logger.error('Failed to update participant media:', error);
      throw new Error('Failed to update participant media');
    }
  }

  getActiveRooms(): VideoBattleRoom[] {
    return Array.from(this.activeRooms.values());
  }

  getRoomById(roomId: string): VideoBattleRoom | undefined {
    return this.activeRooms.get(roomId);
  }

  async cleanupExpiredRooms(): Promise<void> {
    try {
      const now = new Date();
      const expiredRooms: string[] = [];

      for (const [roomId, room] of this.activeRooms) {
        if (room.expiresAt < now) {
          expiredRooms.push(roomId);
        }
      }

      for (const roomId of expiredRooms) {
        await this.endBattleRoom(roomId);
      }

      if (expiredRooms.length > 0) {
        logger.info(`Cleaned up ${expiredRooms.length} expired rooms`);
      }

    } catch (error) {
      logger.error('Failed to cleanup expired rooms:', error);
    }
  }
}

export default VideoBattleService;
