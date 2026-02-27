import { createClient } from '@supabase/supabase-js';

type QueueType = "freestyle" | "ranked" | "tournament";
type BattleFormat = "30s" | "60s" | "90s" | "120s";

interface QueueEntry {
  id: string;
  user_id: string;
  queue_type: QueueType;
  battle_format: BattleFormat;
  status: string;
  created_at: string;
  expires_at: string;
}

interface Battle {
  id: string;
  created_by: string;
  participant_1_id: string | null;
  participant_2_id: string | null;
  queue_type: QueueType;
  battle_format: BattleFormat;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export class ClientMatchmaking {
  private supabase: any;

  constructor() {
    // Client-side initialization - use anon key for client operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase client configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  async enqueue(userId: string, queueType: QueueType, options: {
    battleFormat?: BattleFormat;
    preferredGenres?: string[];
    beatId?: string;
  } = {}) {
    // First try to find a human opponent (quick timeout)
    const humanResponse = await fetch('/api/matchmaking/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queueType,
        battleFormat: options.battleFormat || '60s',
        preferredGenres: options.preferredGenres || [],
      }),
    });

    if (humanResponse.ok) {
      const result = await humanResponse.json();
      return result.entry;
    }

    // If no human found, create bot match
    console.log('No human opponent found, creating bot match...');
    const botResponse = await fetch('/api/matchmaking/bot-match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queueType,
        battleFormat: options.battleFormat || '60s',
        preferredGenres: options.preferredGenres || [],
        beatId: options.beatId,
      }),
    });

    if (!botResponse.ok) {
      const error = await botResponse.json();
      console.error('Bot match API error:', error);
      throw new Error(error.details || error.error || 'Failed to create bot match');
    }

    const result = await botResponse.json();
    return {
      ...result.battle,
      status: 'matched',
      battle_id: result.battle.id,
      is_bot_match: true,
    };
  }

  async dequeue(userId: string) {
    const { error } = await this.supabase
      .from('matchmaking_queue')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Dequeue error:', error);
      throw error;
    }
  }

  async getStatus(userId: string) {
    const { data, error } = await this.supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findMatch(userId: string) {
    // Call the database function to find matches
    const { data, error } = await this.supabase
      .rpc('find_match', { 
        p_user_id: userId, 
        p_queue_type: 'freestyle' 
      });

    if (error) throw error;
    return data;
  }

  async getBattle(battleId: string) {
    const { data, error } = await this.supabase
      .from('battles')
      .select('*')
      .eq('id', battleId)
      .single();

    if (error) throw error;
    return data;
  }
}

// Singleton instance
let matchmakingInstance: ClientMatchmaking | null = null;

export function getMatchmaking() {
  if (!matchmakingInstance) {
    matchmakingInstance = new ClientMatchmaking();
  }
  return matchmakingInstance;
}

export const enqueue = async (userId: string, queueType: QueueType, options?: any) => {
  const matchmaking = getMatchmaking();
  return matchmaking.enqueue(userId, queueType, options);
};

export const getStatus = async (userId: string) => {
  const matchmaking = getMatchmaking();
  return matchmaking.getStatus(userId);
};
