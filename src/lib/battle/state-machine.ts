export type BattleState = 'queued' | 'live_round_1' | 'live_round_2' | 'judging' | 'complete';

export type BattleEvent = 
  | 'session_created'
  | 'player_joined'
  | 'player_left'
  | 'player_ready'
  | 'round_started'
  | 'round_ended'
  | 'voting_started'
  | 'voting_completed'
  | 'battle_completed';

export type BattleAction = 
  | 'create_session'
  | 'join_session'
  | 'leave_session'
  | 'set_ready'
  | 'start_round'
  | 'end_round'
  | 'submit_vote'
  | 'complete_battle';

export interface BattleTransition {
  from: BattleState;
  to: BattleState;
  action: BattleAction;
  guard?: (context: BattleContext) => boolean;
  effect?: (context: BattleContext) => void;
}

export interface BattleContext {
  sessionId: string;
  creatorId: string;
  participants: Array<{
    userId: string;
    slot: 1 | 2;
    status: 'connected' | 'ready' | 'recording' | 'disconnected';
  }>;
  currentRound: number;
  totalRounds: number;
  votes: Array<{
    userId: string;
    roundNumber: number;
    votedFor: string;
  }>;
  winner?: string;
}

export class BattleStateMachine {
  private transitions: Map<string, BattleTransition[]> = new Map();
  
  constructor() {
    this.initializeTransitions();
  }

  private initializeTransitions() {
    const transitions: BattleTransition[] = [
      // Session creation
      {
        from: 'queued',
        to: 'queued',
        action: 'create_session',
        effect: (ctx) => this.logTransition(ctx, 'Session created')
      },
      
      // Player joins
      {
        from: 'queued',
        to: 'queued',
        action: 'join_session',
        guard: (ctx) => ctx.participants.length <= 2,
        effect: (ctx) => {
          this.logTransition(ctx, 'Player joined');
          if (ctx.participants.length === 2) {
            // Auto-start first round when both players are present
            setTimeout(() => {
              this.transition(ctx, 'start_round');
            }, 1000);
          }
        }
      },
      
      // Player leaves
      {
        from: 'queued',
        to: 'queued',
        action: 'leave_session',
        effect: (ctx) => this.logTransition(ctx, 'Player left')
      },
      
      // Start round 1
      {
        from: 'queued',
        to: 'live_round_1',
        action: 'start_round',
        guard: (ctx) => ctx.participants.length === 2,
        effect: (ctx) => {
          this.logTransition(ctx, 'Round 1 started');
          this.startCountdown(ctx, 30);
        }
      },
      
      // End round 1
      {
        from: 'live_round_1',
        to: 'judging',
        action: 'end_round',
        effect: (ctx) => {
          this.logTransition(ctx, 'Round 1 ended, starting voting');
          this.startVoting(ctx, 1);
        }
      },
      
      // Complete voting for round 1
      {
        from: 'judging',
        to: 'live_round_2',
        action: 'complete_battle',
        guard: (ctx) => ctx.currentRound === 1 && ctx.totalRounds === 2 && this.allVotesIn(ctx, 1),
        effect: (ctx) => {
          this.logTransition(ctx, 'Round 1 voting complete, starting round 2');
          this.startRound(ctx, 2);
        }
      },
      
      // Complete voting for round 2 (final)
      {
        from: 'judging',
        to: 'complete',
        action: 'complete_battle',
        guard: (ctx) => ctx.currentRound === 2 && this.allVotesIn(ctx, 2),
        effect: (ctx) => {
          this.logTransition(ctx, 'Battle completed');
          this.determineWinner(ctx);
        }
      },
      
      // Single round battle completion
      {
        from: 'judging',
        to: 'complete',
        action: 'complete_battle',
        guard: (ctx) => ctx.totalRounds === 1 && this.allVotesIn(ctx, 1),
        effect: (ctx) => {
          this.logTransition(ctx, 'Single round battle completed');
          this.determineWinner(ctx);
        }
      },
      
      // Player leaves during live round
      {
        from: 'live_round_1',
        to: 'queued',
        action: 'leave_session',
        effect: (ctx) => {
          this.logTransition(ctx, 'Player left during round, returning to queue');
        }
      },
      
      {
        from: 'live_round_2',
        to: 'judging',
        action: 'leave_session',
        effect: (ctx) => {
          this.logTransition(ctx, 'Player left during round, starting voting');
          this.startVoting(ctx, 2);
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

  canTransition(from: BattleState, to: BattleState, action: BattleAction, context: BattleContext): boolean {
    const key = `${from}->${to}`;
    const possibleTransitions = this.transitions.get(key);
    
    if (!possibleTransitions) {
      return false;
    }
    
    return possibleTransitions.some(transition => 
      transition.action === action && 
      (!transition.guard || transition.guard(context))
    );
  }

  transition(context: BattleContext, action: BattleAction): BattleState | null {
    const currentState = this.getCurrentState(context);
    
    // Find all possible transitions from current state
    for (const [key, transitions] of this.transitions.entries()) {
      if (key.startsWith(`${currentState}->`)) {
        for (const transition of transitions) {
          if (transition.action === action && (!transition.guard || transition.guard(context))) {
            // Execute effect
            if (transition.effect) {
              transition.effect(context);
            }
            
            // Update context
            context.currentRound = transition.to === 'live_round_1' ? 1 : transition.to === 'live_round_2' ? 2 : context.currentRound;
            
            this.logTransition(context, `Transition: ${currentState} -> ${transition.to} (${action})`);
            
            return transition.to;
          }
        }
      }
    }
    
    return null;
  }

  private getCurrentState(context: BattleContext): BattleState {
    // This would typically come from the database
    // For now, infer from context
    if (context.participants.length < 2) return 'queued';
    if (context.currentRound === 0) return 'queued';
    if (context.currentRound === 1 && context.participants.length === 2) return 'live_round_1';
    if (context.currentRound === 2 && context.participants.length === 2) return 'live_round_2';
    if (context.winner) return 'complete';
    return 'judging';
  }

  private allVotesIn(context: BattleContext, roundNumber: number): boolean {
    const votesForRound = context.votes.filter(v => v.roundNumber === roundNumber);
    return votesForRound.length === context.participants.length;
  }

  private startCountdown(context: BattleContext, seconds: number) {
    // This would trigger a countdown timer in the UI
    console.log(`Starting ${seconds} second countdown for session ${context.sessionId}`);
    
    // Emit countdown event
    window.dispatchEvent(new CustomEvent('battle:countdown_start', {
      detail: { sessionId: context.sessionId, seconds }
    }));
  }

  private startVoting(context: BattleContext, roundNumber: number) {
    console.log(`Starting voting for round ${roundNumber} in session ${context.sessionId}`);
    
    // Emit voting event
    window.dispatchEvent(new CustomEvent('battle:voting_start', {
      detail: { sessionId: context.sessionId, roundNumber }
    }));
  }

  private startRound(context: BattleContext, roundNumber: number) {
    console.log(`Starting round ${roundNumber} in session ${context.sessionId}`);
    
    // Emit round start event
    window.dispatchEvent(new CustomEvent('battle:round_start', {
      detail: { sessionId: context.sessionId, roundNumber }
    }));
  }

  private determineWinner(context: BattleContext) {
    if (context.votes.length === 0) {
      context.winner = undefined;
      return;
    }
    
    // Count votes for each participant
    const voteCounts: Record<string, number> = {};
    for (const vote of context.votes) {
      voteCounts[vote.votedFor] = (voteCounts[vote.votedFor] || 0) + 1;
    }
    
    // Find winner (most votes)
    let maxVotes = 0;
    let winner: string | undefined;
    
    for (const [userId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = userId;
      }
    }
    
    context.winner = winner;
    
    console.log(`Winner determined: ${winner} with ${maxVotes} votes`);
    
    // Emit winner event
    window.dispatchEvent(new CustomEvent('battle:winner_determined', {
      detail: { sessionId: context.sessionId, winner, voteCounts }
    }));
  }

  private logTransition(context: BattleContext, message: string) {
    console.log(`[BattleStateMachine] Session ${context.sessionId}: ${message}`);
  }

  // Get valid transitions from current state
  getValidTransitions(currentState: BattleState, context: BattleContext): BattleTransition[] {
    const validTransitions: BattleTransition[] = [];
    
    for (const [key, transitions] of this.transitions.entries()) {
      if (key.startsWith(`${currentState}->`)) {
        for (const transition of transitions) {
          if (!transition.guard || transition.guard(context)) {
            validTransitions.push(transition);
          }
        }
      }
    }
    
    return validTransitions;
  }

  // Validate battle state integrity
  validateState(context: BattleContext): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check participant count
    if (context.participants.length > 2) {
      errors.push('Too many participants (max 2)');
    }
    
    // Check round numbers
    if (context.currentRound < 0 || context.currentRound > context.totalRounds) {
      errors.push('Invalid round number');
    }
    
    // Check votes
    for (const vote of context.votes) {
      if (vote.roundNumber < 1 || vote.roundNumber > context.totalRounds) {
        errors.push(`Invalid vote round number: ${vote.roundNumber}`);
      }
      
      if (!context.participants.some(p => p.userId === vote.userId)) {
        errors.push(`Vote from non-participant: ${vote.userId}`);
      }
      
      if (!context.participants.some(p => p.userId === vote.votedFor)) {
        errors.push(`Vote for non-participant: ${vote.votedFor}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
