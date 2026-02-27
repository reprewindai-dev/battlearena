import { createClient } from '@supabase/supabase-js';
import { RealtimeChannel } from '@supabase/realtime-js';

export type BattleSessionState = {
  id: string;
  status: 'queued' | 'live_round_1' | 'live_round_2' | 'judging' | 'complete';
  current_round: number;
  total_rounds: number;
  countdown_seconds: number;
  locked_beat_id?: string;
  winner?: string;
  created_at: string;
  updated_at: string;
};

export type BattlePresence = {
  user_id: string;
  slot: 1 | 2;
  status: 'connected' | 'ready' | 'recording' | 'disconnected';
  display_name: string;
  joined_at: string;
};

export type BattleMessage = {
  id: string;
  user_id: string;
  body: string;
  timestamp: number;
};

export type BattleVote = {
  user_id: string;
  round_number: number;
  voted_for: string;
  timestamp: number;
};

export class BattleRealtimeSync {
  private supabase: any;
  private channel: RealtimeChannel | null = null;
  private sessionId: string;
  private userId: string;

  constructor(sessionId: string, userId: string) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // Connect to battle channel
  async connect() {
    const channelName = `battle:${this.sessionId}`;
    
    this.channel = this.supabase
      .channel(channelName)
      .on('broadcast', { event: 'session_state' }, (payload: any) => {
        this.handleSessionStateUpdate(payload.payload as BattleSessionState);
      })
      .on('broadcast', { event: 'presence' }, (payload: any) => {
        this.handlePresenceUpdate(payload.payload as BattlePresence);
      })
      .on('broadcast', { event: 'chat' }, (payload: any) => {
        this.handleChatMessage(payload.payload as BattleMessage);
      })
      .on('broadcast', { event: 'vote' }, (payload: any) => {
        this.handleVote(payload.payload as BattleVote);
      })
      .on('presence', { event: 'sync' }, () => {
        this.handlePresenceSync();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        this.handleUserJoin(key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
        this.handleUserLeave(key, leftPresences);
      });

    if (this.channel) {
      const status = await this.channel.subscribe();
      if (typeof status === 'string' && status !== 'SUBSCRIBED' && status !== 'CHANNEL_ERROR') {
        throw new Error(`Failed to subscribe to battle channel: ${status}`);
      }
    }

    // Track this user's presence
    if (this.channel) {
      await this.channel.track({
        user_id: this.userId,
        status: 'connected',
        online_at: new Date().toISOString(),
      });
    }

    return this.channel;
  }

  // Disconnect from battle channel
  async disconnect() {
    if (this.channel) {
      await this.channel.untrack();
      await this.channel.unsubscribe();
      this.channel = null;
    }
  }

  // Server-authoritative session state updates
  async updateSessionState(state: Partial<BattleSessionState>) {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'session_state_intent',
      payload: {
        user_id: this.userId,
        updates: state,
        timestamp: Date.now(),
      },
    });
  }

  // Client intents (server validates and applies)
  async sendReady() {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'ready_intent',
      payload: {
        user_id: this.userId,
        timestamp: Date.now(),
      },
    });
  }

  async sendVote(roundNumber: number, votedFor: string) {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'vote_intent',
      payload: {
        user_id: this.userId,
        round_number: roundNumber,
        voted_for: votedFor,
        timestamp: Date.now(),
      },
    });
  }

  async sendChatMessage(message: string) {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'chat_intent',
      payload: {
        user_id: this.userId,
        body: message,
        timestamp: Date.now(),
      },
    });
  }

  async sendLeave() {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'leave_intent',
      payload: {
        user_id: this.userId,
        timestamp: Date.now(),
      },
    });
  }

  // Event handlers (to be overridden by consuming component)
  private handleSessionStateUpdate(state: BattleSessionState) {
    // Emit custom event for React components
    window.dispatchEvent(new CustomEvent('battle:session_state', { detail: state }));
  }

  private handlePresenceUpdate(presence: BattlePresence) {
    window.dispatchEvent(new CustomEvent('battle:presence', { detail: presence }));
  }

  private handleChatMessage(message: BattleMessage) {
    window.dispatchEvent(new CustomEvent('battle:chat', { detail: message }));
  }

  private handleVote(vote: BattleVote) {
    window.dispatchEvent(new CustomEvent('battle:vote', { detail: vote }));
  }

  private handlePresenceSync() {
    // Sync all presence data
    window.dispatchEvent(new CustomEvent('battle:presence_sync'));
  }

  private handleUserJoin(key: string, newPresences: any[]) {
    window.dispatchEvent(new CustomEvent('battle:user_join', { detail: { key, presences: newPresences } }));
  }

  private handleUserLeave(key: string, leftPresences: any[]) {
    window.dispatchEvent(new CustomEvent('battle:user_leave', { detail: { key, presences: leftPresences } }));
  }

  // Get current channel status
  getChannelStatus() {
    const state = (this.channel as any)?.state;
    return state?.status ?? state;
  }

  // Get current presence state
  getPresenceState() {
    return this.channel?.presenceState();
  }
}
