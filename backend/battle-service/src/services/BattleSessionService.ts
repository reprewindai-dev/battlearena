import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { setCache, getCache, deleteCache } from '../config/redis';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { WebSocketService } from './WebSocketService';

export type BattleSessionState = 'queued' | 'live_round_1' | 'live_round_2' | 'judging' | 'complete';

export interface BattleSession {
  id: string;
  creator_id: string;
  battle_type: 'ranked' | 'casual' | 'tournament';
  format: '30s' | '60s' | '90s';
  entry_fee_tokens: number;
  total_rounds: number;
  current_round: number;
  status: BattleSessionState;
  countdown_seconds: number;
  locked_beat_id?: string;
  winner?: string;
  participants: BattleParticipant[];
  created_at: Date;
  updated_at: Date;
}

export interface BattleParticipant {
  user_id: string;
  slot: 1 | 2;
  status: 'connected' | 'ready' | 'recording' | 'disconnected';
  display_name: string;
  joined_at: Date;
}

export interface BattleMessage {
  id: string;
  user_id: string;
  body: string;
  timestamp: number;
}

export interface BattleVote {
  id: string;
  user_id: string;
  round_number: number;
  voted_for: string;
  timestamp: number;
}

export interface CreateSessionData {
  creator_id: string;
  battle_type: 'ranked' | 'casual' | 'tournament';
  format: '30s' | '60s' | '90s';
  entry_fee_tokens: number;
  total_rounds: number;
}

export class BattleSessionService {
  private webSocketService: WebSocketService;

  constructor() {
    this.webSocketService = new WebSocketService();
  }

  async createSession(data: CreateSessionData): Promise<BattleSession> {
    try {
      const sessionId = uuidv4();
      
      const result = await query(
        `INSERT INTO battle_sessions (
           id, creator_id, battle_type, format, entry_fee_tokens,
           total_rounds, current_round, status, countdown_seconds,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          sessionId,
          data.creator_id,
          data.battle_type,
          data.format,
          data.entry_fee_tokens,
          data.total_rounds,
          1,
          'queued',
          0,
          new Date(),
          new Date()
        ]
      );
      
      const session = result.rows[0];
      
      // Cache the session
      await setCache(`session:${sessionId}`, session, 3600);
      
      // Add creator as first participant
      await this.addParticipant(sessionId, data.creator_id, 1);
      
      logger.info('Battle session created', { sessionId, creatorId: data.creator_id });
      
      return session;
    } catch (error) {
      logger.error('Error creating battle session:', error);
      throw createError('Failed to create battle session', 500);
    }
  }

  async getSessionById(sessionId: string): Promise<BattleSession | null> {
    try {
      // Check cache first
      const cached = await getCache(`session:${sessionId}`);
      if (cached) {
        return cached;
      }
      
      const result = await query(
        'SELECT * FROM battle_sessions WHERE id = $1',
        [sessionId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const session = result.rows[0];
      
      // Get participants
      const participantsResult = await query(
        'SELECT * FROM battle_participants WHERE session_id = $1 ORDER BY slot',
        [sessionId]
      );
      
      session.participants = participantsResult.rows;
      
      // Cache for 1 hour
      await setCache(`session:${sessionId}`, session, 3600);
      
      return session;
    } catch (error) {
      logger.error('Error getting battle session:', error);
      throw createError('Failed to get battle session', 500);
    }
  }

  async joinSession(sessionId: string, userId: string): Promise<{ session: BattleSession; participant: BattleParticipant }> {
    try {
      const session = await this.getSessionById(sessionId);
      if (!session) {
        throw createError('Session not found', 404);
      }
      
      if (session.participants.length >= 2) {
        throw createError('Session is full', 400);
      }
      
      // Determine slot (1 or 2)
      const slot = session.participants.length === 0 ? 1 : 2;
      
      const participant = await this.addParticipant(sessionId, userId, slot);
      
      // Update session status if both players are ready
      if (session.participants.length === 1) {
        await this.updateSessionState(sessionId, { status: 'live_round_1' });
      }
      
      const updatedSession = await this.getSessionById(sessionId);
      
      return { session: updatedSession!, participant };
    } catch (error) {
      logger.error('Error joining battle session:', error);
      throw error;
    }
  }

  async leaveSession(sessionId: string, userId: string): Promise<BattleSession> {
    try {
      // Remove participant
      await query(
        'DELETE FROM battle_participants WHERE session_id = $1 AND user_id = $2',
        [sessionId, userId]
      );
      
      // Update session status
      const session = await this.getSessionById(sessionId);
      if (session && session.participants.length <= 1) {
        await this.updateSessionState(sessionId, { status: 'queued' });
      }
      
      const updatedSession = await this.getSessionById(sessionId);
      
      if (!updatedSession) {
        throw createError('Failed to update session', 500);
      }
      
      return updatedSession;
    } catch (error) {
      logger.error('Error leaving battle session:', error);
      throw createError('Failed to leave battle session', 500);
    }
  }

  async canUserUpdateSession(userId: string, session: BattleSession, updates: any): Promise<boolean> {
    // Only creator can update most fields
    if (session.creator_id !== userId) {
      // Non-creators can only send intents (handled separately)
      return false;
    }
    
    // Creators can update these fields
    const allowedUpdates = ['status', 'current_round', 'countdown_seconds', 'locked_beat_id', 'winner'];
    const updateKeys = Object.keys(updates);
    
    return updateKeys.every(key => allowedUpdates.includes(key));
  }

  async updateSessionState(sessionId: string, updates: Partial<BattleSession>): Promise<BattleSession> {
    try {
      const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = Object.values(updates);
      
      const result = await query(
        `UPDATE battle_sessions SET ${setClause}, updated_at = $1 WHERE id = $${values.length + 2} RETURNING *`,
        [new Date(), ...values, sessionId]
      );
      
      const updatedSession = result.rows[0];
      
      // Update cache
      await setCache(`session:${sessionId}`, updatedSession, 3600);
      
      return updatedSession;
    } catch (error) {
      logger.error('Error updating session state:', error);
      throw createError('Failed to update session state', 500);
    }
  }

  async handleReadyIntent(sessionId: string, userId: string): Promise<{ session: BattleSession; message: string }> {
    try {
      // Update participant status
      await query(
        'UPDATE battle_participants SET status = $1 WHERE session_id = $2 AND user_id = $3',
        ['ready', sessionId, userId]
      );
      
      const session = await this.getSessionById(sessionId);
      if (!session) {
        throw createError('Session not found', 404);
      }
      
      // Check if all participants are ready
      const allReady = session.participants.every(p => p.status === 'ready');
      
      if (allReady && session.status === 'live_round_1') {
        // Start countdown
        await this.updateSessionState(sessionId, { 
          status: 'live_round_1',
          countdown_seconds: 30 
        });

        const refreshed = await this.getSessionById(sessionId);
        if (!refreshed) {
          throw createError('Session not found after update', 404);
        }

        return { 
          session: refreshed,
          message: 'All players ready! Starting countdown...' 
        };
      }
      
      return { 
        session,
        message: 'Ready status updated' 
      };
    } catch (error) {
      logger.error('Error handling ready intent:', error);
      throw error;
    }
  }

  async handleVoteIntent(sessionId: string, userId: string, roundNumber: number, votedFor: string): Promise<BattleVote> {
    try {
      const voteId = uuidv4();
      
      const result = await query(
        `INSERT INTO battle_votes (id, session_id, user_id, round_number, voted_for, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [voteId, sessionId, userId, roundNumber, votedFor, Date.now()]
      );
      
      const vote = result.rows[0];
      
      // Check if all votes are in for this round
      const session = await this.getSessionById(sessionId);
      if (session) {
        const voteCount = await query(
          'SELECT COUNT(*) as count FROM battle_votes WHERE session_id = $1 AND round_number = $2',
          [sessionId, roundNumber]
        );
        
        if (parseInt(voteCount.rows[0].count) === session.participants.length) {
          // All votes in, move to judging
          await this.updateSessionState(sessionId, { status: 'judging' });
        }
      }
      
      return vote;
    } catch (error) {
      logger.error('Error handling vote intent:', error);
      throw createError('Failed to submit vote', 500);
    }
  }

  async handleChatIntent(sessionId: string, userId: string, body: string): Promise<BattleMessage> {
    try {
      const messageId = uuidv4();
      
      const result = await query(
        `INSERT INTO battle_messages (id, session_id, user_id, body, timestamp)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [messageId, sessionId, userId, body, Date.now()]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error handling chat intent:', error);
      throw createError('Failed to send message', 500);
    }
  }

  async startRound(sessionId: string): Promise<BattleSession> {
    try {
      const session = await this.getSessionById(sessionId);
      if (!session) {
        throw createError('Session not found', 404);
      }
      
      const nextRound = session.current_round + 1;
      const nextStatus = nextRound === 1 ? 'live_round_1' : nextRound === 2 ? 'live_round_2' : 'judging';
      
      const updatedSession = await this.updateSessionState(sessionId, {
        current_round: nextRound,
        status: nextStatus as BattleSessionState,
        countdown_seconds: 30
      });
      
      return updatedSession;
    } catch (error) {
      logger.error('Error starting round:', error);
      throw createError('Failed to start round', 500);
    }
  }

  async endRound(sessionId: string): Promise<{ session: BattleSession; votes: BattleVote[] }> {
    try {
      // Update session status to judging
      const updatedSession = await this.updateSessionState(sessionId, { status: 'judging' });
      
      // Get votes for current round
      const votesResult = await query(
        'SELECT * FROM battle_votes WHERE session_id = $1 AND round_number = $2',
        [sessionId, updatedSession.current_round]
      );

      return { session: updatedSession, votes: votesResult.rows as BattleVote[] };
    } catch (error) {
      logger.error('Error ending round:', error);
      throw createError('Failed to end round', 500);
    }
  }

  async getSessionHistory(sessionId: string): Promise<any[]> {
    try {
      const result = await query(
        `SELECT * FROM battle_session_history 
         WHERE session_id = $1 
         ORDER BY timestamp DESC`,
        [sessionId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting session history:', error);
      throw createError('Failed to get session history', 500);
    }
  }

  // WebSocket broadcasting methods
  async broadcastSessionUpdate(sessionId: string, session: BattleSession) {
    await this.webSocketService.broadcastToChannel(`battle:${sessionId}`, {
      type: 'session_state',
      payload: session
    });
  }

  async broadcastVote(sessionId: string, vote: BattleVote) {
    await this.webSocketService.broadcastToChannel(`battle:${sessionId}`, {
      type: 'vote',
      payload: vote
    });
  }

  async broadcastChatMessage(sessionId: string, message: BattleMessage) {
    await this.webSocketService.broadcastToChannel(`battle:${sessionId}`, {
      type: 'chat',
      payload: message
    });
  }

  private async addParticipant(sessionId: string, userId: string, slot: 1 | 2): Promise<BattleParticipant> {
    try {
      const result = await query(
        `INSERT INTO battle_participants (session_id, user_id, slot, status, display_name, joined_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [sessionId, userId, slot, 'connected', `User_${userId.slice(-4)}`, new Date()]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error adding participant:', error);
      throw createError('Failed to add participant', 500);
    }
  }
}
