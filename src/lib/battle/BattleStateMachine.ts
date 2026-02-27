export type BattleState = 
  | 'CREATED'
  | 'CHECKIN' 
  | 'CONFIG'
  | 'COUNTDOWN'
  | 'LIVE_ROUND_1'
  | 'INTERMISSION'
  | 'LIVE_ROUND_2'
  | 'JUDGING'
  | 'FINALIZING'
  | 'COMPLETE'
  | 'CANCELLED'
  | 'FORFEIT'
  | 'ERROR';

export type BattleAction = 
  | 'create_session'
  | 'join'
  | 'leave'
  | 'set_ready'
  | 'cancel'
  | 'lock_config'
  | 'start_countdown'
  | 'start_round'
  | 'end_round'
  | 'start_judging'
  | 'finalize'
  | 'complete'
  | 'admin_transition';

export type BattleRole = 'player' | 'judge' | 'admin' | 'system';

export interface BattleSlot {
  userId: string;
  present: boolean;
  ready: boolean;
  joinedAt: Date;
  lastSeen: Date;
}

export interface BattleConfig {
  rounds: number;
  roundDurationMs: number;
  beat: {
    beatId: string;
    locked: boolean;
  };
  hostId?: string;
}

export interface BattleTimers {
  serverNow: number;
  checkinDeadlineAt?: number;
  countdownStartsAt?: number;
  round1StartsAt?: number;
  round1EndsAt?: number;
  intermissionStartsAt?: number;
  intermissionEndsAt?: number;
  round2StartsAt?: number;
  round2EndsAt?: number;
  judgingStartsAt?: number;
  judgingEndsAt?: number;
  finalizeAt?: number;
}

export interface BattleScores {
  A: number;
  B: number;
}

export interface BattleSession {
  id: string;
  state: BattleState;
  revision: number;
  slots: {
    A: BattleSlot | null;
    B: BattleSlot | null;
  };
  config: BattleConfig;
  timers: BattleTimers;
  scores: BattleScores;
  winner?: 'A' | 'B';
  cancelReason?: string;
  forfeitReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BattleTransition {
  from: BattleState;
  to: BattleState;
  trigger: BattleAction;
  guard?: (ctx: BattleContext) => boolean;
  effect?: (ctx: BattleContext) => void;
  auditLog?: (ctx: BattleContext, transition: BattleTransition) => void;
}

export interface BattleContext {
  session: BattleSession;
  actor: {
    userId: string;
    role: BattleRole;
  };
  intent?: any;
  serverNow: number;
  timers: BattleTimers;
  gracePeriodMs?: number;
}

export class BattleStateMachine {
  private transitions: Map<string, BattleTransition[]> = new Map();
  
  // Good enough defaults
  private readonly GRACE_PERIOD_MS = 15000;
  private readonly CHECKIN_TIMEOUT_MS = 60000;
  private readonly COUNTDOWN_MS = 5000;
  private readonly DEFAULT_ROUND_DURATION_MS = 30000;
  private readonly JUDGING_WINDOW_MS = 30000;
  private readonly INTERMISSION_MS = 10000;

  constructor() {
    this.initializeTransitions();
  }

  private initializeTransitions() {
    const transitions: BattleTransition[] = [
      // Session creation
      {
        from: 'CREATED',
        to: 'CHECKIN',
        trigger: 'create_session',
        effect: (ctx) => {
          ctx.session.timers.checkinDeadlineAt = ctx.serverNow + this.CHECKIN_TIMEOUT_MS;
          this.auditLog(ctx, {
            from: 'CREATED',
            to: 'CHECKIN',
            trigger: 'create_session',
            message: 'Session created, starting check-in'
          });
        }
      },

      // Check-in to Config (both players ready)
      {
        from: 'CHECKIN',
        to: 'CONFIG',
        trigger: 'set_ready',
        guard: (ctx) => Boolean(ctx.session.slots.A?.ready && ctx.session.slots.B?.ready),
        effect: (ctx) => {
          // Lock slots and assign host if needed
          this.lockSlots(ctx);
          ctx.session.timers.checkinDeadlineAt = undefined;
          this.auditLog(ctx, {
            from: 'CHECKIN',
            to: 'CONFIG',
            trigger: 'set_ready',
            message: 'Both players ready, moving to config'
          });
        }
      },

      // Check-in timeout
      {
        from: 'CHECKIN',
        to: 'CANCELLED',
        trigger: 'cancel',
        guard: (ctx) => ctx.serverNow >= (ctx.session.timers.checkinDeadlineAt || 0),
        effect: (ctx) => {
          ctx.session.state = 'CANCELLED';
          ctx.session.cancelReason = 'Check-in timeout';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'CHECKIN',
            to: 'CANCELLED',
            trigger: 'cancel',
            message: 'Check-in timeout'
          });
        }
      },

      // Config to Countdown
      {
        from: 'CONFIG',
        to: 'COUNTDOWN',
        trigger: 'lock_config',
        guard: (ctx) => ctx.session.config.beat.locked,
        effect: (ctx) => {
          const countdownStartsAt = ctx.serverNow + 1000; // 1s buffer
          const round1StartsAt = countdownStartsAt + this.COUNTDOWN_MS;
          
          ctx.session.timers.countdownStartsAt = countdownStartsAt;
          ctx.session.timers.round1StartsAt = round1StartsAt;
          ctx.session.timers.round1EndsAt = round1StartsAt + ctx.session.config.roundDurationMs;
          
          // Set round 2 timers if applicable
          if (ctx.session.config.rounds === 2) {
            ctx.session.timers.intermissionStartsAt = ctx.session.timers.round1EndsAt + 1000;
            ctx.session.timers.intermissionEndsAt = ctx.session.timers.intermissionStartsAt + this.INTERMISSION_MS;
            ctx.session.timers.round2StartsAt = ctx.session.timers.intermissionEndsAt + 1000;
            ctx.session.timers.round2EndsAt = ctx.session.timers.round2StartsAt + ctx.session.config.roundDurationMs;
          }
          
          ctx.session.state = 'COUNTDOWN';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'CONFIG',
            to: 'COUNTDOWN',
            trigger: 'lock_config',
            message: 'Config locked, starting countdown'
          });
        }
      },

      // Countdown to Live Round 1
      {
        from: 'COUNTDOWN',
        to: 'LIVE_ROUND_1',
        trigger: 'start_round',
        guard: (ctx) => ctx.serverNow >= (ctx.session.timers.countdownStartsAt || 0),
        effect: (ctx) => {
          ctx.session.state = 'LIVE_ROUND_1';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'COUNTDOWN',
            to: 'LIVE_ROUND_1',
            trigger: 'start_round',
            message: 'Round 1 started'
          });
        }
      },

      // Live Round 1 to Intermission (2 rounds)
      {
        from: 'LIVE_ROUND_1',
        to: 'INTERMISSION',
        trigger: 'end_round',
        guard: (ctx) => ctx.session.config.rounds === 2 && ctx.serverNow >= (ctx.session.timers.round1EndsAt || 0),
        effect: (ctx) => {
          ctx.session.state = 'INTERMISSION';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'LIVE_ROUND_1',
            to: 'INTERMISSION',
            trigger: 'end_round',
            message: 'Round 1 ended, starting intermission'
          });
        }
      },

      // Live Round 1 to Judging (1 round)
      {
        from: 'LIVE_ROUND_1',
        to: 'JUDGING',
        trigger: 'end_round',
        guard: (ctx) => ctx.session.config.rounds === 1 && ctx.serverNow >= (ctx.session.timers.round1EndsAt || 0),
        effect: (ctx) => {
          ctx.session.state = 'JUDGING';
          ctx.session.timers.judgingStartsAt = ctx.serverNow;
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'LIVE_ROUND_1',
            to: 'JUDGING',
            trigger: 'end_round',
            message: 'Round 1 ended, starting judging'
          });
        }
      },

      // Intermission to Countdown (round 2)
      {
        from: 'INTERMISSION',
        to: 'COUNTDOWN',
        trigger: 'start_round',
        guard: (ctx) => ctx.serverNow >= (ctx.session.timers.intermissionEndsAt || 0),
        effect: (ctx) => {
          const round2StartsAt = ctx.serverNow + 1000;
          ctx.session.timers.round2StartsAt = round2StartsAt;
          ctx.session.timers.round2EndsAt = round2StartsAt + ctx.session.config.roundDurationMs;
          
          ctx.session.state = 'COUNTDOWN';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'INTERMISSION',
            to: 'COUNTDOWN',
            trigger: 'start_round',
            message: 'Intermission ended, starting round 2 countdown'
          });
        }
      },

      // Countdown to Live Round 2
      {
        from: 'COUNTDOWN',
        to: 'LIVE_ROUND_2',
        trigger: 'start_round',
        guard: (ctx) => ctx.session.config.rounds === 2 && ctx.serverNow >= (ctx.session.timers.round2StartsAt || 0),
        effect: (ctx) => {
          ctx.session.state = 'LIVE_ROUND_2';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'COUNTDOWN',
            to: 'LIVE_ROUND_2',
            trigger: 'start_round',
            message: 'Round 2 started'
          });
        }
      },

      // Live Round 2 to Judging
      {
        from: 'LIVE_ROUND_2',
        to: 'JUDGING',
        trigger: 'end_round',
        guard: (ctx) => ctx.serverNow >= (ctx.timers.round2EndsAt || 0),
        effect: (ctx) => {
          ctx.session.state = 'JUDGING';
          ctx.session.timers.judgingStartsAt = ctx.serverNow;
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'LIVE_ROUND_2',
            to: 'JUDGING',
            trigger: 'end_round',
            message: 'Round 2 ended, starting judging'
          });
        }
      },

      // Judging to Finalizing
      {
        from: 'JUDGING',
        to: 'FINALIZING',
        trigger: 'finalize',
        guard: (ctx) => {
          // Voting window closed OR all required votes received
          const votingWindowClosed = ctx.serverNow >= (ctx.session.timers.judgingStartsAt! + this.JUDGING_WINDOW_MS);
          const allVotesIn = this.allVotesIn(ctx);
          return votingWindowClosed || allVotesIn;
        },
        effect: (ctx) => {
          this.computeResult(ctx);
          ctx.session.state = 'FINALIZING';
          ctx.session.timers.finalizeAt = ctx.serverNow + 5000; // 5s buffer for finalization
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'JUDGING',
            to: 'FINALIZING',
            trigger: 'finalize',
            message: 'Voting complete, finalizing results'
          });
        }
      },

      // Finalizing to Complete
      {
        from: 'FINALIZING',
        to: 'COMPLETE',
        trigger: 'complete',
        guard: (ctx) => ctx.serverNow >= (ctx.session.timers.finalizeAt || 0),
        effect: (ctx) => {
          ctx.session.state = 'COMPLETE';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'FINALIZING',
            to: 'COMPLETE',
            trigger: 'complete',
            message: 'Battle completed'
          });
        }
      },

      // Forfeit handling (any live state)
      {
        from: 'COUNTDOWN',
        to: 'FORFEIT',
        trigger: 'leave',
        guard: (ctx) => this.shouldForfeit(ctx),
        effect: (ctx) => {
          this.handleForfeit(ctx);
          ctx.session.state = 'FORFEIT';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'COUNTDOWN',
            to: 'FORFEIT',
            trigger: 'leave',
            message: `Player forfeited: ${ctx.session.forfeitReason}`
          });
        }
      },

      {
        from: 'LIVE_ROUND_1',
        to: 'FORFEIT',
        trigger: 'leave',
        guard: (ctx) => this.shouldForfeit(ctx),
        effect: (ctx) => {
          this.handleForfeit(ctx);
          ctx.session.state = 'FORFEIT';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'LIVE_ROUND_1',
            to: 'FORFEIT',
            trigger: 'leave',
            message: `Player forfeited: ${ctx.session.forfeitReason}`
          });
        }
      },

      {
        from: 'LIVE_ROUND_2',
        to: 'FORFEIT',
        trigger: 'leave',
        guard: (ctx) => this.shouldForfeit(ctx),
        effect: (ctx) => {
          this.handleForfeit(ctx);
          ctx.session.state = 'FORFEIT';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'LIVE_ROUND_2',
            to: 'FORFEIT',
            trigger: 'leave',
            message: `Player forfeited: ${ctx.session.forfeitReason}`
          });
        }
      },

      {
        from: 'JUDGING',
        to: 'FORFEIT',
        trigger: 'leave',
        guard: (ctx) => this.shouldForfeit(ctx),
        effect: (ctx) => {
          this.handleForfeit(ctx);
          ctx.session.state = 'FORFEIT';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'JUDGING',
            to: 'FORFEIT',
            trigger: 'leave',
            message: `Player forfeited during judging: ${ctx.session.forfeitReason}`
          });
        }
      },

      // Admin overrides
      {
        from: 'CREATED',
        to: 'CANCELLED',
        trigger: 'admin_transition',
        effect: (ctx) => {
          ctx.session.state = 'CANCELLED';
          ctx.session.cancelReason = ctx.intent?.reason || 'Admin cancelled';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'CREATED',
            to: 'CANCELLED',
            trigger: 'admin_transition',
            message: `Admin cancelled: ${ctx.session.cancelReason}`
          });
        }
      },

      {
        from: 'CHECKIN',
        to: 'CANCELLED',
        trigger: 'admin_transition',
        effect: (ctx) => {
          ctx.session.state = 'CANCELLED';
          ctx.session.cancelReason = ctx.intent?.reason || 'Admin cancelled';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'CHECKIN',
            to: 'CANCELLED',
            trigger: 'admin_transition',
            message: `Admin cancelled: ${ctx.session.cancelReason}`
          });
        }
      },

      {
        from: 'CONFIG',
        to: 'CANCELLED',
        trigger: 'admin_transition',
        effect: (ctx) => {
          ctx.session.state = 'CANCELLED';
          ctx.session.cancelReason = ctx.intent?.reason || 'Admin cancelled';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'CONFIG',
            to: 'CANCELLED',
            trigger: 'admin_transition',
            message: `Admin cancelled: ${ctx.session.cancelReason}`
          });
        }
      },

      {
        from: 'COUNTDOWN',
        to: 'CANCELLED',
        trigger: 'admin_transition',
        effect: (ctx) => {
          ctx.session.state = 'CANCELLED';
          ctx.session.cancelReason = ctx.intent?.reason || 'Admin cancelled';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'COUNTDOWN',
            to: 'CANCELLED',
            trigger: 'admin_transition',
            message: `Admin cancelled: ${ctx.session.cancelReason}`
          });
        }
      },

      {
        from: 'LIVE_ROUND_1',
        to: 'CANCELLED',
        trigger: 'admin_transition',
        effect: (ctx) => {
          ctx.session.state = 'CANCELLED';
          ctx.session.cancelReason = ctx.intent?.reason || 'Admin cancelled';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'LIVE_ROUND_1',
            to: 'CANCELLED',
            trigger: 'admin_transition',
            message: `Admin cancelled: ${ctx.session.cancelReason}`
          });
        }
      },

      {
        from: 'INTERMISSION',
        to: 'CANCELLED',
        trigger: 'admin_transition',
        effect: (ctx) => {
          ctx.session.state = 'CANCELLED';
          ctx.session.cancelReason = ctx.intent?.reason || 'Admin cancelled';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'INTERMISSION',
            to: 'CANCELLED',
            trigger: 'admin_transition',
            message: `Admin cancelled: ${ctx.session.cancelReason}`
          });
        }
      },

      {
        from: 'LIVE_ROUND_2',
        to: 'CANCELLED',
        trigger: 'admin_transition',
        effect: (ctx) => {
          ctx.session.state = 'CANCELLED';
          ctx.session.cancelReason = ctx.intent?.reason || 'Admin cancelled';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'LIVE_ROUND_2',
            to: 'CANCELLED',
            trigger: 'admin_transition',
            message: `Admin cancelled: ${ctx.session.cancelReason}`
          });
        }
      },

      {
        from: 'JUDGING',
        to: 'CANCELLED',
        trigger: 'admin_transition',
        effect: (ctx) => {
          ctx.session.state = 'CANCELLED';
          ctx.session.cancelReason = ctx.intent?.reason || 'Admin cancelled';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'JUDGING',
            to: 'CANCELLED',
            trigger: 'admin_transition',
            message: `Admin cancelled: ${ctx.session.cancelReason}`
          });
        }
      },

      {
        from: 'FINALIZING',
        to: 'CANCELLED',
        trigger: 'admin_transition',
        effect: (ctx) => {
          ctx.session.state = 'CANCELLED';
          ctx.session.cancelReason = ctx.intent?.reason || 'Admin cancelled';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'FINALIZING',
            to: 'CANCELLED',
            trigger: 'admin_transition',
            message: `Admin cancelled: ${ctx.session.cancelReason}`
          });
        }
      },

      {
        from: 'FORFEIT',
        to: 'COMPLETE',
        trigger: 'admin_transition',
        effect: (ctx) => {
          ctx.session.state = 'COMPLETE';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'FORFEIT',
            to: 'COMPLETE',
            trigger: 'admin_transition',
            message: `Admin completed forfeited battle: ${ctx.session.winner}`
          });
        }
      },

      {
        from: 'ERROR',
        to: 'COMPLETE',
        trigger: 'admin_transition',
        effect: (ctx) => {
          ctx.session.state = 'COMPLETE';
          ctx.session.updatedAt = new Date();
          this.auditLog(ctx, {
            from: 'ERROR',
            to: 'COMPLETE',
            trigger: 'admin_transition',
            message: `Admin completed error state`
          });
        }
      }
    ];

    // Group transitions by from state
    for (const transition of transitions) {
      const key = `${transition.from}->${transition.to}`;
      if (!this.transitions.has(key)) {
        this.transitions.set(key, []);
      }
      this.transitions.get(key)!.push(transition);
    }
  }

  // Main transition method
  transition(context: BattleContext): BattleSession | null {
    const currentState = context.session.state;
    const trigger = context.intent?.type || context.intent;
    
    // Find matching transitions
    for (const [key, transitions] of this.transitions.entries()) {
      if (key.startsWith(`${currentState}->`)) {
        for (const transition of transitions) {
          if (transition.trigger === trigger && (!transition.guard || transition.guard(context))) {
            // Execute effect
            if (transition.effect) {
              transition.effect(context);
            }
            
            // Update session state
            context.session.state = transition.to;
            context.session.revision += 1;
            context.session.updatedAt = new Date();
            
            // Log transition
            this.auditLog(context, {
              from: currentState,
              to: transition.to,
              trigger,
              message: `Transition: ${currentState} -> ${transition.to} (${trigger})`
            });
            
            return context.session;
          }
        }
      }
    }
    
    return null;
  }

  // Helper methods
  private bothPlayersReady(ctx: BattleContext): boolean {
    return Boolean(ctx.session.slots.A?.ready) && Boolean(ctx.session.slots.B?.ready);
  }

  private lockSlots(ctx: BattleContext): void {
    // Assign host if not assigned
    if (!ctx.session.config.hostId && ctx.session.slots.A?.userId && ctx.session.slots.B?.userId) {
      ctx.session.config.hostId = ctx.session.slots.A.userId; // A gets host by default
    }
  }

  private shouldForfeit(ctx: BattleContext): boolean {
    const gracePeriodMs = ctx.gracePeriodMs || this.GRACE_PERIOD_MS;
    const lastSeen = ctx.actor.userId === ctx.session.slots.A?.userId 
      ? ctx.session.slots.A.lastSeen.getTime()
      : ctx.session.slots.B?.lastSeen?.getTime();
    
    const timeSinceLastSeen = ctx.serverNow - (lastSeen || 0);
    
    return timeSinceLastSeen > gracePeriodMs;
  }

  private handleForfeit(ctx: BattleContext): void {
    const remainingPlayer = ctx.actor.userId === ctx.session.slots.A?.userId ? ctx.session.slots.B : ctx.session.slots.A;
    
    if (remainingPlayer) {
      ctx.session.winner = remainingPlayer.userId === ctx.session.slots.A?.userId ? 'A' : 'B';
      ctx.session.scores[ctx.session.winner] = 100; // Winner gets 100 points
    }
    
    ctx.session.forfeitReason = ctx.intent?.reason || 'Player disconnected';
  }

  private computeResult(ctx: BattleContext): void {
    // Simple majority vote counting
    const voteCounts: Record<string, number> = {};
    
    // This would come from the database in real implementation
    // For now, we'll use the scores array
    if (ctx.session.scores.A > ctx.session.scores.B) {
      ctx.session.winner = 'A';
    } else if (ctx.session.scores.B > ctx.session.scores.A) {
      ctx.session.winner = 'B';
    }
  }

  private allVotesIn(ctx: BattleContext): boolean {
    // In real implementation, this would check the database
    // For now, assume votes are in session.scores
    return ctx.session.scores.A > 0 && ctx.session.scores.B > 0;
  }

  private auditLog(ctx: BattleContext, audit: {
    from: BattleState;
    to: BattleState;
    trigger: BattleAction;
    message: string;
  }): void {
    // In real implementation, this would write to an audit log table
    console.log(`[BattleStateMachine] ${ctx.session.id}: ${audit.message}`);
  }

  // Get valid transitions from current state
  getValidTransitions(state: BattleState): BattleTransition[] {
    const validTransitions: BattleTransition[] = [];
    
    for (const [key, transitions] of this.transitions.entries()) {
      if (key.startsWith(`${state}->`)) {
        validTransitions.push(...transitions);
      }
    }
    
    return validTransitions;
  }

  // Validate state integrity
  validateState(session: BattleSession): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check slot integrity
    const hasA = !!session.slots.A?.userId;
    const hasB = !!session.slots.B?.userId;
    if (!(hasA && hasB)) {
      errors.push('Battle must have exactly 2 participants');
    }
    
    // Check state sequence validity
    const validSequences: BattleState[][] = [
      ['CREATED', 'CHECKIN', 'CONFIG', 'COUNTDOWN', 'LIVE_ROUND_1', 'INTERMISSION', 'LIVE_ROUND_2', 'JUDGING', 'FINALIZING', 'COMPLETE'],
      ['CREATED', 'CHECKIN', 'CONFIG', 'COUNTDOWN', 'LIVE_ROUND_1', 'JUDGING', 'FINALIZING', 'COMPLETE'],
      ['CREATED', 'CHECKIN', 'CANCELLED'],
      ['CONFIG', 'CANCELLED'],
      ['COUNTDOWN', 'CANCELLED'],
      ['LIVE_ROUND_1', 'FORFEIT'],
      ['LIVE_ROUND_2', 'FORFEIT'],
      ['JUDGING', 'FORFEIT'],
      ['FINALIZING', 'COMPLETE'],
      ['FORFEIT', 'COMPLETE'],
      ['ERROR', 'COMPLETE']
    ];
    
    const currentStateIndex = this.getStateIndex(session.state);
    const validSequence = validSequences.find(sequence => 
      sequence[currentStateIndex] === session.state
    );
    
    if (!validSequence) {
      errors.push(`Invalid state sequence: ${session.state}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private getStateIndex(state: BattleState): number {
    const states: BattleState[] = [
      'CREATED', 'CHECKIN', 'CONFIG', 'COUNTDOWN', 'LIVE_ROUND_1', 'INTERMISSION', 'LIVE_ROUND_2', 'JUDGING', 'FINALIZING', 'COMPLETE', 'CANCELLED', 'FORFEIT', 'ERROR'
    ];
    return states.indexOf(state);
  }
}
