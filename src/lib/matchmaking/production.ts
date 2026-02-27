import { createClient } from '@supabase/supabase-js';

type QueueType = "freestyle" | "ranked" | "tournament";
type BattleFormat = "30s" | "60s" | "90s" | "120s";
type BattleStatus = "waiting" | "matched" | "in_progress" | "completed" | "cancelled";

interface QueueEntry {
  id: string;
  user_id: string;
  queue_type: QueueType;
  battle_format: BattleFormat;
  entry_fee: number;
  preferred_genres: string[];
  min_elo: number;
  max_elo: number;
  status: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

interface Battle {
  id: string;
  created_by: string;
  participant_1_id: string | null;
  participant_2_id: string | null;
  queue_type: QueueType;
  battle_format: BattleFormat;
  entry_fee: number;
  prize_pool: number;
  beat_id: string | null;
  participant_1_beat_id: string | null;
  participant_2_beat_id: string | null;
  status: BattleStatus;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
  winner_id: string | null;
  participant_1_score: number;
  participant_2_score: number;
  participant_1_votes: number;
  participant_2_votes: number;
  room_id: string | null;
  livekit_room_id: string | null;
  recording_url: string | null;
  processed_url: string | null;
  egress_id: string | null;
  created_at: string;
  updated_at: string;
}

export class ProductionMatchmaking {
  private supabase: any;

  constructor() {
    // Use client-side environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || (typeof window !== 'undefined' && (window as any).env?.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || (typeof window !== 'undefined' && (window as any).env?.SUPABASE_SERVICE_ROLE_KEY);
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase config:', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseServiceKey,
        envUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        envKey: process.env.SUPABASE_SERVICE_ROLE_KEY
      });
      throw new Error('Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false
      }
    });
  }

  async enqueue(userId: string, queueType: QueueType, options: {
    battleFormat?: BattleFormat;
    entryFee?: number;
    preferredGenres?: string[];
    minElo?: number;
    maxElo?: number;
  } = {}): Promise<{ status: string; battle_id?: string }> {
    try {
      const {
        battleFormat = '60s',
        entryFee = 0,
        preferredGenres = [],
        minElo = 0,
        maxElo = 9999
      } = options;

      // Check if user is already in queue
      const { data: existing } = await this.supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('user_id', userId)
        .eq('queue_type', queueType)
        .eq('status', 'active')
        .single();

      if (existing) {
        return { status: 'already_queued' };
      }

      // Add user to queue
      const { data: queueEntry, error } = await this.supabase
        .from('matchmaking_queue')
        .insert({
          user_id: userId,
          queue_type: queueType,
          battle_format: battleFormat,
          entry_fee: entryFee,
          preferred_genres: preferredGenres,
          min_elo: minElo,
          max_elo: maxElo,
          status: 'active',
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
        })
        .select()
        .single();

      if (error) throw error;
      if (!queueEntry) throw new Error('Failed to join queue');

      // Try to find a match immediately
      const matchResult = await this.findMatch(userId, queueType, battleFormat, minElo, maxElo);

      return matchResult;
    } catch (error) {
      console.error('Matchmaking enqueue error:', error);
      throw error;
    }
  }

  async getStatus(userId: string, queueType: QueueType): Promise<QueueEntry | null> {
    try {
      const { data, error } = await this.supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('user_id', userId)
        .eq('queue_type', queueType)
        .eq('status', 'active')
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      console.error('Matchmaking status error:', error);
      return null;
    }
  }

  async leaveQueue(userId: string, queueType: QueueType): Promise<void> {
    try {
      await this.supabase
        .from('matchmaking_queue')
        .update({ status: 'cancelled' })
        .eq('user_id', userId)
        .eq('queue_type', queueType)
        .eq('status', 'active');
    } catch (error) {
      console.error('Leave queue error:', error);
      throw error;
    }
  }

  private async findMatch(
    userId: string, 
    queueType: QueueType, 
    battleFormat: BattleFormat,
    minElo: number,
    maxElo: number
  ): Promise<{ status: string; battle_id?: string }> {
    try {
      // Use the PostgreSQL function to find available opponents
      const { data: opponents, error } = await this.supabase
        .rpc('get_available_opponents', {
          p_user_id: userId,
          p_queue_type: queueType,
          p_battle_format: battleFormat,
          p_min_elo: minElo,
          p_max_elo: maxElo
        });

      if (error) throw error;
      if (!opponents || opponents.length === 0) {
        return { status: 'queued' };
      }

      const opponent = opponents[0];
      const battleId = this.generateBattleId();

      // Create battle
      const { data: battle, error: battleError } = await this.supabase
        .from('battles')
        .insert({
          created_by: userId,
          participant_1_id: userId,
          participant_2_id: opponent.user_id,
          queue_type: queueType,
          battle_format: battleFormat,
          status: 'matched',
          room_id: battleId,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
        })
        .select()
        .single();

      if (battleError) throw battleError;
      if (!battle) throw new Error('Failed to create battle');

      // Update both users to matched status
      await this.supabase
        .from('matchmaking_queue')
        .update({ status: 'matched' })
        .in('user_id', [userId, opponent.user_id])
        .eq('queue_type', queueType)
        .eq('status', 'active');

      return { 
        status: 'matched', 
        battle_id: battle.id 
      };
    } catch (error) {
      console.error('Find match error:', error);
      return { status: 'queued' };
    }
  }

  private generateBattleId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `battle_${timestamp}_${random}`;
  }

  async getBattle(battleId: string): Promise<Battle | null> {
    try {
      const { data, error } = await this.supabase
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      console.error('Get battle error:', error);
      return null;
    }
  }

  async updateBattleStatus(battleId: string, status: BattleStatus, data?: Partial<Battle>): Promise<void> {
    try {
      const updateData: any = { status };
      if (data) {
        Object.assign(updateData, data);
      }

      if (status === 'in_progress') {
        updateData.started_at = new Date().toISOString();
      } else if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        
        // Update ELO ratings if ranked battle
        if (data?.queue_type === 'ranked' && data?.winner_id) {
          await this.supabase.rpc('update_elo_ratings', {
            p_battle_id: battleId,
            p_winner_id: data.winner_id,
            p_participant_1_id: data.participant_1_id,
            p_participant_2_id: data.participant_2_id,
            p_queue_type: data.queue_type
          });
        }
      }

      await this.supabase
        .from('battles')
        .update(updateData)
        .eq('id', battleId);
    } catch (error) {
      console.error('Update battle status error:', error);
      throw error;
    }
  }

  async getUserElo(userId: string, queueType: QueueType): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('user_elo_ratings')
        .select('current_elo')
        .eq('user_id', userId)
        .eq('queue_type', queueType)
        .single();

      if (error) return 1000; // Default ELO
      return data?.current_elo || 1000;
    } catch (error) {
      console.error('Get user ELO error:', error);
      return 1000;
    }
  }

  async getQueueStats(queueType: QueueType, battleFormat: BattleFormat): Promise<{
    totalQueued: number;
    avgWaitTime: number;
    activeBattles: number;
  }> {
    try {
      // Get queue stats
      const { data: queueData } = await this.supabase
        .from('matchmaking_queue')
        .select('created_at')
        .eq('queue_type', queueType)
        .eq('battle_format', battleFormat)
        .eq('status', 'active');

      // Get active battles
      const { data: battleData } = await this.supabase
        .from('battles')
        .select('id')
        .eq('queue_type', queueType)
        .eq('battle_format', battleFormat)
        .in('status', ['matched', 'in_progress']);

      const totalQueued = queueData?.length || 0;
      const activeBattles = battleData?.length || 0;
      
      // Calculate average wait time
      const avgWaitTime = queueData && queueData.length > 0
        ? queueData.reduce((acc, q) => acc + (Date.now() - new Date(q.created_at).getTime()), 0) / queueData.length / 1000
        : 0;

      return {
        totalQueued,
        avgWaitTime: Math.round(avgWaitTime),
        activeBattles
      };
    } catch (error) {
      console.error('Get queue stats error:', error);
      return { totalQueued: 0, avgWaitTime: 0, activeBattles: 0 };
    }
  }
}

// Singleton instance
let matchmakingInstance: ProductionMatchmaking | null = null;

export function getMatchmaking(): ProductionMatchmaking {
  if (!matchmakingInstance) {
    matchmakingInstance = new ProductionMatchmaking();
  }
  return matchmakingInstance;
}

// Export functions for backward compatibility
export async function enqueue(userId: string, mode: string): Promise<any> {
  const queueType = mode as QueueType;
  return getMatchmaking().enqueue(userId, queueType);
}

export async function getStatus(userId: string, mode: string): Promise<any> {
  const queueType = mode as QueueType;
  return getMatchmaking().getStatus(userId, queueType);
}

export async function leaveQueue(userId: string, mode: string): Promise<void> {
  const queueType = mode as QueueType;
  return getMatchmaking().leaveQueue(userId, queueType);
}
