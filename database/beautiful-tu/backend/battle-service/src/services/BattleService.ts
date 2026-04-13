import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { setCache, getCache } from '../config/redis';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface Battle {
  id: string;
  room_code: string;
  title: string;
  battle_type: 'ranked' | 'casual' | 'tournament';
  format: '30s' | '60s' | '90s';
  entry_fee_tokens: number;
  max_participants: number;
  current_participants: number;
  status: 'waiting' | 'active' | 'completed';
  beat_id?: string;
  created_by: string;
  created_at: Date;
  starts_at?: Date;
  ends_at?: Date;
}

export interface BattleCreateData {
  title?: string;
  battle_type: 'ranked' | 'casual' | 'tournament';
  format: '30s' | '60s' | '90s';
  entry_fee_tokens: number;
  max_participants: number;
  beat_preferences?: {
    genre?: string;
    tempo_range?: [number, number];
  };
  created_by: string;
}

export class BattleService {
  async createBattle(data: BattleCreateData): Promise<Battle> {
    try {
      const battleId = uuidv4();
      const roomCode = this.generateRoomCode();
      
      const result = await query(
        `INSERT INTO battles (
           id, room_code, title, battle_type, format, 
           entry_fee_tokens, max_participants, current_participants,
           status, created_by, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          battleId,
          roomCode,
          data.title || `${data.battle_type} Battle`,
          data.battle_type,
          data.format,
          data.entry_fee_tokens,
          data.max_participants,
          1, // creator is first participant
          'waiting',
          data.created_by,
          new Date()
        ]
      );
      
      const battle = result.rows[0];
      
      // Cache the battle
      await setCache(`battle:${battleId}`, battle, 3600);
      
      logger.info('Battle created', { battleId, roomCode, createdBy: data.created_by });
      
      return battle;
    } catch (error) {
      logger.error('Error creating battle:', error);
      throw createError('Failed to create battle', 500);
    }
  }
  
  async getBattleById(battleId: string): Promise<Battle> {
    try {
      // Check cache first
      const cached = await getCache(`battle:${battleId}`);
      if (cached) {
        return cached;
      }
      
      const result = await query(
        'SELECT * FROM battles WHERE id = $1',
        [battleId]
      );
      
      if (result.rows.length === 0) {
        throw createError('Battle not found', 404);
      }
      
      const battle = result.rows[0];
      
      // Cache for 1 hour
      await setCache(`battle:${battleId}`, battle, 3600);
      
      return battle;
    } catch (error) {
      logger.error('Error getting battle by ID:', error);
      throw error;
    }
  }
  
  async getAvailableBattles(options: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ battles: Battle[]; total: number }> {
    try {
      const { status = 'waiting', limit = 20, offset = 0 } = options;
      
      // Get total count
      const countResult = await query(
        'SELECT COUNT(*) as total FROM battles WHERE status = $1',
        [status]
      );
      const total = parseInt(countResult.rows[0].total);
      
      // Get battles with pagination
      const battlesResult = await query(
        `SELECT * FROM battles 
         WHERE status = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [status, limit, offset]
      );
      
      const battles = battlesResult.rows as Battle[];
      
      return { battles, total };
    } catch (error) {
      logger.error('Error getting available battles:', error);
      throw createError('Failed to get available battles', 500);
    }
  }
  
  async joinBattle(battleId: string, userId: string): Promise<Battle> {
    try {
      const battle = await this.getBattleById(battleId);
      
      if (battle.status !== 'waiting') {
        throw createError('Battle is not accepting new participants', 400);
      }
      
      if (battle.current_participants >= battle.max_participants) {
        throw createError('Battle is full', 400);
      }
      
      // Add participant
      await query(
        'INSERT INTO battle_participants (battle_id, user_id, joined_at) VALUES ($1, $2, $3)',
        [battleId, userId, new Date()]
      );
      
      // Update participant count
      const result = await query(
        'UPDATE battles SET current_participants = current_participants + 1 WHERE id = $1 RETURNING *',
        [battleId]
      );
      
      const updatedBattle = result.rows[0];
      
      // Update cache
      await setCache(`battle:${battleId}`, updatedBattle, 3600);
      
      logger.info('User joined battle', { battleId, userId });
      
      return updatedBattle;
    } catch (error) {
      logger.error('Error joining battle:', error);
      throw error;
    }
  }
  
  async leaveBattle(battleId: string, userId: string): Promise<Battle> {
    try {
      const battle = await this.getBattleById(battleId);
      
      if (battle.status === 'completed') {
        throw createError('Cannot leave a completed battle', 400);
      }
      
      // Remove participant
      await query(
        'DELETE FROM battle_participants WHERE battle_id = $1 AND user_id = $2',
        [battleId, userId]
      );
      
      // Update participant count
      const result = await query(
        'UPDATE battles SET current_participants = current_participants - 1 WHERE id = $1 RETURNING *',
        [battleId]
      );
      
      const updatedBattle = result.rows[0];
      
      // Update cache
      await setCache(`battle:${battleId}`, updatedBattle, 3600);
      
      logger.info('User left battle', { battleId, userId });
      
      return updatedBattle;
    } catch (error) {
      logger.error('Error leaving battle:', error);
      throw error;
    }
  }
  
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
