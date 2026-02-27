// Realtime message contract for battle system

export interface BattleMessage {
  v: 1;
  type: string;
  battleId: string;
  eventId: string;
  ts: number;
  actor: {
    userId: string;
    role: 'player' | 'judge' | 'admin' | 'system';
  };
  payload: any;
}

// Client → Server Intents
export interface ClientIntents {
  'battle.join': {
    slot: 'A' | 'B' | 'spectator';
  };
  
  'battle.ready': {
    ready: boolean;
  };
  
  'battle.leave': {
    reason: 'user_exit' | 'error';
  };
  
  'battle.chat.send': {
    text: string;
    clientMsgId: string;
  };
  
  'battle.vote.cast': {
    target: 'A' | 'B';
    weight: number;
    clientVoteId: string;
  };
  
  'battle.beat.select': {
    beatId: string;
    source: 'library';
  };
  
  'battle.admin.transition': {
    to: 'JUDGING' | 'COMPLETE' | 'CANCELLED';
    reason: string;
  };
}

// Server → Client Facts
export interface ServerFacts {
  'battle.state': {
    state: 'CREATED' | 'CHECKIN' | 'CONFIG' | 'COUNTDOWN' | 'LIVE_ROUND_1' | 'INTERMISSION' | 'LIVE_ROUND_2' | 'JUDGING' | 'FINALIZING' | 'COMPLETE' | 'CANCELLED' | 'FORFEIT' | 'ERROR';
    revision: number;
    slots: {
      A: {
        userId?: string;
        present: boolean;
        ready: boolean;
      } | null;
      B: {
        userId?: string;
        present: boolean;
        ready: boolean;
      } | null;
    };
    config: {
      rounds: number;
      roundDurationMs: number;
      beat: {
        beatId: string;
        locked: boolean;
      };
    };
    timers: {
      serverNow: number;
      countdownStartsAt?: number;
      round1StartsAt?: number;
      round1EndsAt?: number;
      round2StartsAt?: number;
      round2EndsAt?: number;
      judgingStartsAt?: number;
      judgingEndsAt?: number;
    };
    scores: {
      A: number;
      B: number;
    };
    winner?: 'A' | 'B';
    cancelReason?: string;
    forfeitReason?: string;
  };
  
  'battle.presence': {
    userId: string;
    status: 'join' | 'leave' | 'timeout';
  };
  
  'battle.chat.message': {
    msgId: string;
    userId: string;
    text: string;
    ts: number;
  };
  
  'battle.vote.update': {
    totals: {
      A: number;
      B: number;
    };
    locked: boolean;
  };
  
  'battle.error': {
    code: 'NOT_AUTHORIZED' | 'INVALID_STATE' | 'RATE_LIMIT';
    message: string;
  };
}

export class BattleRealtimeContract {
  // Channel names
  static readonly BATTLE_CHANNEL = (battleId: string) => `battle:${battleId}`;
  static readonly MEDIA_CHANNEL = (battleId: string) => `battle:${battleId}:media`;
  
  // Message creation helpers
  static createClientMessage<T extends keyof ClientIntents>(
    type: T,
    battleId: string,
    actor: { userId: string; role: string },
    payload: ClientIntents[T]
  ): BattleMessage {
    return {
      v: 1,
      type,
      battleId,
      eventId: this.generateEventId(),
      ts: Date.now(),
      actor: actor as any,
      payload
    };
  }
  
  static createServerMessage<T extends keyof ServerFacts>(
    type: T,
    battleId: string,
    actor: { userId: string; role: string },
    payload: ServerFacts[T]
  ): BattleMessage {
    return {
      v: 1,
      type,
      battleId,
      eventId: this.generateEventId(),
      ts: Date.now(),
      actor: actor as any,
      payload
    };
  }
  
  // Validation helpers
  static validateClientMessage(message: BattleMessage): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!message.battleId) errors.push('battleId is required');
    if (!message.eventId) errors.push('eventId is required');
    if (!message.actor.userId) errors.push('actor.userId is required');
    if (!message.actor.role) errors.push('actor.role is required');
    if (message.v !== 1) errors.push('version must be 1');
    if (!message.ts || message.ts <= 0) errors.push('timestamp must be positive');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  static validateServerMessage(message: BattleMessage): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!message.battleId) errors.push('battleId is required');
    if (!message.eventId) errors.push('eventId is required');
    if (!message.actor.userId) errors.push('actor.userId is required');
    if (!message.actor.role) errors.push('actor.role is required');
    if (message.v !== 1) errors.push('version must be 1');
    if (!message.ts || message.ts <= 0) errors.push('timestamp must be positive');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Rate limiting helpers
  static checkRateLimit(userId: string, type: string, lastSent: number): boolean {
    const now = Date.now();
    const minInterval = this.getMinInterval(type);
    
    return (now - lastSent) >= minInterval;
  }
  
  private static getMinInterval(type: string): number {
    const intervals: Record<string, number> = {
      'battle.chat.send': 1000, // 1 second
      'battle.vote.cast': 5000,  // 5 seconds
      'battle.ready': 2000,      // 2 seconds
      'battle.join': 5000,       // 5 seconds
      'battle.leave': 1000,      // 1 second
      'battle.beat.select': 2000, // 2 seconds
      'battle.admin.transition': 1000 // 1 second
    };
    
    return intervals[type] || 1000;
  }
  
  // Message deduplication
  static isDuplicate(message: BattleMessage, processedEvents: Set<string>): boolean {
    return processedEvents.has(message.eventId);
  }
  
  static markProcessed(message: BattleMessage, processedEvents: Set<string>): void {
    processedEvents.add(message.eventId);
    
    // Keep only last 1000 events to prevent memory leaks
    if (processedEvents.size > 1000) {
      const events = Array.from(processedEvents);
      processedEvents.clear();
      events.slice(-1000).forEach(id => processedEvents.add(id));
    }
  }
  
  // Payload validation
  static validatePayload(type: string, payload: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    switch (type) {
      case 'battle.join':
        if (!payload.slot || !['A', 'B', 'spectator'].includes(payload.slot)) {
          errors.push('slot must be A, B, or spectator');
        }
        break;
        
      case 'battle.chat.send':
        if (!payload.text || typeof payload.text !== 'string') {
          errors.push('text is required and must be a string');
        }
        if (payload.text.length > 500) {
          errors.push('text must be 500 characters or less');
        }
        if (!payload.clientMsgId) {
          errors.push('clientMsgId is required');
        }
        break;
        
      case 'battle.vote.cast':
        if (!payload.target || !['A', 'B'].includes(payload.target)) {
          errors.push('target must be A or B');
        }
        if (typeof payload.weight !== 'number' || payload.weight < 1 || payload.weight > 10) {
          errors.push('weight must be a number between 1 and 10');
        }
        if (!payload.clientVoteId) {
          errors.push('clientVoteId is required');
        }
        break;
        
      case 'battle.beat.select':
        if (!payload.beatId) {
          errors.push('beatId is required');
        }
        if (!payload.source || payload.source !== 'library') {
          errors.push('source must be library');
        }
        break;
        
      case 'battle.admin.transition':
        if (!payload.to || !['JUDGING', 'COMPLETE', 'CANCELLED'].includes(payload.to)) {
          errors.push('to must be JUDGING, COMPLETE, or CANCELLED');
        }
        if (!payload.reason) {
          errors.push('reason is required');
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Message sanitization
  static sanitizePayload(type: string, payload: any): any {
    switch (type) {
      case 'battle.chat.send':
        return {
          ...payload,
          text: payload.text.replace(/<script[^>]*>.*?<\/script>/gi, '').substring(0, 500)
        };
        
      default:
        return payload;
    }
  }
  
  // Event ID generation
  private static generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Message serialization
  static serialize(message: BattleMessage): string {
    return JSON.stringify(message);
  }
  
  static deserialize(data: string): BattleMessage | null {
    try {
      const parsed = JSON.parse(data);
      if (this.validateClientMessage(parsed).isValid || this.validateServerMessage(parsed).isValid) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }
  
  // Channel subscription validation
  static canSubscribeToChannel(channel: string, userId: string, battleId: string): boolean {
    if (channel === this.BATTLE_CHANNEL(battleId)) {
      return true; // Anyone can subscribe to battle channel
    }
    
    if (channel === this.MEDIA_CHANNEL(battleId)) {
      return true; // Anyone can subscribe to media channel
    }
    
    return false;
  }
  
  // Message routing
  static routeMessage(message: BattleMessage): {
    isClientIntent: boolean;
    isServerFact: boolean;
    messageType: string;
  } {
    const clientIntents = [
      'battle.join',
      'battle.ready', 
      'battle.leave',
      'battle.chat.send',
      'battle.vote.cast',
      'battle.beat.select',
      'battle.admin.transition'
    ];
    
    const serverFacts = [
      'battle.state',
      'battle.presence',
      'battle.chat.message',
      'battle.vote.update',
      'battle.error'
    ];
    
    return {
      isClientIntent: clientIntents.includes(message.type),
      isServerFact: serverFacts.includes(message.type),
      messageType: message.type
    };
  }
  
  // Message priority for ordering
  static getMessagePriority(type: string): number {
    const priorities: Record<string, number> = {
      'battle.state': 1,        // Highest priority
      'battle.presence': 2,
      'battle.error': 3,
      'battle.vote.update': 4,
      'battle.chat.message': 5,
      'battle.join': 6,
      'battle.leave': 7,
      'battle.ready': 8,
      'battle.beat.select': 9,
      'battle.vote.cast': 10,
      'battle.admin.transition': 11 // Lowest priority
    };
    
    return priorities[type] || 100;
  }
  
  // Message ordering
  static sortMessages(messages: BattleMessage[]): BattleMessage[] {
    return messages.sort((a, b) => {
      const priorityA = this.getMessagePriority(a.type);
      const priorityB = this.getMessagePriority(b.type);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Same priority, sort by timestamp
      return a.ts - b.ts;
    });
  }
}
