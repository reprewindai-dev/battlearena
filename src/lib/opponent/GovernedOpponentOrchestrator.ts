import { runGovernedExecution } from "@/lib/governance/runGovernedExecution";
import { createClient } from '@supabase/supabase-js';

export interface OpponentPlanBundle {
  match_id: string;
  opponent_plan: OpponentPlan;
  governance_metadata: GovernanceMetadata;
  deterministic_seed: number;
}

export interface OpponentPlan {
  persona: "Aggro" | "Turtle" | "Counter" | "Gambler";
  skill_band: "easy" | "mid" | "hard";
  reaction_base_ms: number;
  reaction_jitter_ms: number;
  mistake_rate: number;
  hesitation_rate: number;
  drama_archetype: "close_win" | "close_loss" | "comeback" | "control_win" | "stomp_rare";
  swing_windows: Array<{start_pct: number, end_pct: number, intensity: number}>;
  risk_bounds: {
    max_win_bias: number;
    max_loss_bias: number;
  };
}

export interface GovernanceMetadata {
  tier: string;
  risk_scores: any;
  validation_results: any;
  cost_estimate: number;
  latency_ms: number;
  model_version: string;
  plan_id: string;
  generated_at: string;
}

export interface PlayerContext {
  id: string;
  mmr: number;
  region: string;
  skill_level: string;
  recent_matches: any[];
}

export interface MatchContext {
  mode: "ranked" | "casual";
  queue_time: number;
  expected_duration: number;
}

export class GovernedOpponentOrchestrator {
  private supabase: any;
  private circuitBreaker: CircuitBreaker;
  private telemetryEmitter: TelemetryEmitter;
  private fairnessMonitor: FairnessMonitor;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.supabase =
      supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
    this.circuitBreaker = new CircuitBreaker();
    this.telemetryEmitter = new TelemetryEmitter();
    this.fairnessMonitor = new FairnessMonitor();
  }

  async generateOpponentPlan(
    playerContext: PlayerContext,
    matchContext: MatchContext
  ): Promise<OpponentPlanBundle> {
    const startTime = Date.now();
    const match_id = this.generateMatchId();

    try {
      // Check circuit breaker
      if (this.circuitBreaker.isOpen()) {
        throw new Error('Circuit breaker is open - using fallback mode');
      }

      // Governance entry point - NO direct model calls
      const governanceResult = await runGovernedExecution({
        execution_type: "OPPONENT_PLAN",
        playerContext,
        matchContext
      });

      if (!governanceResult.success) {
        throw new Error(`Governance failed: ${governanceResult.error}`);
      }

      // Validate strict schema
      const opponentPlan = this.validateAndSanitizePlan(governanceResult.data);
      
      // Generate deterministic seed for real-time execution
      const deterministic_seed = this.generateDeterministicSeed(playerContext, matchContext);

      const bundle: OpponentPlanBundle = {
        match_id,
        opponent_plan: opponentPlan,
        governance_metadata: {
          tier: governanceResult.governance_tier,
          risk_scores: governanceResult.risk_scores,
          validation_results: governanceResult.validation_results,
          cost_estimate: governanceResult.cost_estimate || 0,
          latency_ms: governanceResult.latency_ms || 0,
          model_version: governanceResult.validation_results?.model_version || '1.0',
          plan_id: this.generatePlanId(),
          generated_at: new Date().toISOString()
        },
        deterministic_seed
      };

      // Persist observability data
      await this.persistMatchObservability(bundle);

      // Check latency target
      const latency = Date.now() - startTime;
      if (latency > 300) {
        this.circuitBreaker.recordFailure();
        console.warn(`Plan generation latency exceeded 300ms: ${latency}ms`);
      }

      return bundle;

    } catch (error) {
      const latency = Date.now() - startTime;
      this.circuitBreaker.recordFailure();
      
      // Fallback to deterministic heuristic mode
      return this.generateFallbackPlan(playerContext, matchContext, match_id, error);
    }
  }

  private validateAndSanitizePlan(plan: any): OpponentPlan {
    // Strict schema validation - BLOCK if invalid
    const required = [
      'persona', 'skill_band', 'reaction_base_ms', 'reaction_jitter_ms',
      'mistake_rate', 'hesitation_rate', 'drama_archetype', 'swing_windows', 'risk_bounds'
    ];

    for (const field of required) {
      if (!(field in plan)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate persona
    const validPersonas = ["Aggro", "Turtle", "Counter", "Gambler"];
    if (!validPersonas.includes(plan.persona)) {
      throw new Error(`Invalid persona: ${plan.persona}`);
    }

    // Validate skill band
    const validSkillBands = ["easy", "mid", "hard"];
    if (!validSkillBands.includes(plan.skill_band)) {
      throw new Error(`Invalid skill_band: ${plan.skill_band}`);
    }

    // Validate drama archetype
    const validArchetypes = ["close_win", "close_loss", "comeback", "control_win", "stomp_rare"];
    if (!validArchetypes.includes(plan.drama_archetype)) {
      throw new Error(`Invalid drama_archetype: ${plan.drama_archetype}`);
    }

    // HARD FAIRNESS BOUNDS - BLOCK if violated
    if (plan.risk_bounds.max_win_bias > 0.12 || plan.risk_bounds.max_loss_bias > 0.12) {
      throw new Error('Risk bounds exceed 0.12 threshold - BLOCKED');
    }

    // Validate humanization constraints
    this.validateHumanizationConstraints(plan);

    return plan as OpponentPlan;
  }

  private validateHumanizationConstraints(plan: OpponentPlan) {
    const constraints = {
      easy: { reaction_base: 420, reaction_jitter: 180, mistake_min: 0.10, mistake_max: 0.14, hesitation: 0.12 },
      mid: { reaction_base: 320, reaction_jitter: 140, mistake_min: 0.06, mistake_max: 0.10, hesitation: 0.10 },
      hard: { reaction_base: 240, reaction_jitter: 120, mistake_min: 0.03, mistake_max: 0.06, hesitation: 0.08 }
    };

    const constraint = constraints[plan.skill_band];
    
    if (Math.abs(plan.reaction_base_ms - constraint.reaction_base) > 50) {
      throw new Error(`Reaction base out of bounds for ${plan.skill_band}`);
    }

    if (plan.reaction_jitter_ms > constraint.reaction_jitter * 1.5) {
      throw new Error(`Reaction jitter out of bounds for ${plan.skill_band}`);
    }

    if (plan.mistake_rate < constraint.mistake_min || plan.mistake_rate > constraint.mistake_max) {
      throw new Error(`Mistake rate out of bounds for ${plan.skill_band}`);
    }

    if (plan.hesitation_rate > constraint.hesitation * 1.5) {
      throw new Error(`Hesitation rate out of bounds for ${plan.skill_band}`);
    }
  }

  private generateFallbackPlan(
    playerContext: PlayerContext,
    matchContext: MatchContext,
    match_id: string,
    error: any
  ): OpponentPlanBundle {
    console.warn('Using fallback deterministic plan due to error:', error.message);

    const skill_band = playerContext.mmr < 1200 ? 'easy' : playerContext.mmr < 1800 ? 'mid' : 'hard';
    const personas = ["Aggro", "Turtle", "Counter", "Gambler"];
    const persona = personas[Math.floor(Math.abs(this.hashString(playerContext.id)) % personas.length)] as any;
    
    const fallbackPlan: OpponentPlan = {
      persona,
      skill_band,
      reaction_base_ms: skill_band === 'easy' ? 420 : skill_band === 'mid' ? 320 : 240,
      reaction_jitter_ms: skill_band === 'easy' ? 180 : skill_band === 'mid' ? 140 : 120,
      mistake_rate: skill_band === 'easy' ? 0.12 : skill_band === 'mid' ? 0.08 : 0.045,
      hesitation_rate: skill_band === 'easy' ? 0.12 : skill_band === 'mid' ? 0.10 : 0.08,
      drama_archetype: 'control_win',
      swing_windows: [{ start_pct: 0.2, end_pct: 0.5, intensity: 0.3 }],
      risk_bounds: { max_win_bias: 0.12, max_loss_bias: 0.12 }
    };

    return {
      match_id,
      opponent_plan: fallbackPlan,
      governance_metadata: {
        tier: 'FALLBACK',
        risk_scores: { overall: 0, level: 'LOW' },
        validation_results: { fallback_reason: error.message },
        cost_estimate: 0,
        latency_ms: 0,
        model_version: 'fallback',
        plan_id: this.generatePlanId(),
        generated_at: new Date().toISOString()
      },
      deterministic_seed: this.generateDeterministicSeed(playerContext, matchContext)
    };
  }

  private generateDeterministicSeed(playerContext: PlayerContext, matchContext: MatchContext): number {
    const seedString = `${playerContext.id}-${matchContext.mode}-${Date.now()}`;
    return this.hashString(seedString);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private generateMatchId(): string {
    return `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async persistMatchObservability(bundle: OpponentPlanBundle) {
    if (!this.supabase) {
      return;
    }
    try {
      await this.supabase.from('match_opponent_plans').insert({
        match_id: bundle.match_id,
        plan_id: bundle.governance_metadata.plan_id,
        governance_tier: bundle.governance_metadata.tier,
        risk_scores: bundle.governance_metadata.risk_scores,
        persona: bundle.opponent_plan.persona,
        drama_archetype: bundle.opponent_plan.drama_archetype,
        difficulty_band: bundle.opponent_plan.skill_band,
        cost_per_plan: bundle.governance_metadata.cost_estimate,
        latency_ms: bundle.governance_metadata.latency_ms,
        model_version: bundle.governance_metadata.model_version,
        threshold_version: '1.0',
        validation_results: bundle.governance_metadata.validation_results,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to persist observability data:', error);
    }
  }

  // Real-time execution methods (NO LLM calls)
  calculateReactionDelay(plan: OpponentPlan, gameState: any, rng: any): number {
    const base = plan.reaction_base_ms;
    const jitter = (rng.next() - 0.5) * 2 * plan.reaction_jitter_ms;
    
    // Apply hesitation events
    let hesitation = 0;
    if (rng.next() < plan.hesitation_rate) {
      hesitation = 250 + rng.next() * 650; // 250-900ms hesitation
    }

    // Apply drama modifiers
    const dramaModifier = this.calculateDramaModifier(plan, gameState, rng);

    return Math.max(50, base + jitter + hesitation + dramaModifier);
  }

  shouldMakeMistake(plan: OpponentPlan, gameState: any, rng: any): boolean {
    let mistakeRate = plan.mistake_rate;

    // Increase mistakes under pressure
    if (gameState.isCloseMatch && gameState.isLateGame) {
      mistakeRate *= 1.5;
    }

    // Apply drama swing windows
    for (const window of plan.swing_windows) {
      const matchProgress = gameState.elapsed / gameState.expectedDuration;
      if (matchProgress >= window.start_pct && matchProgress <= window.end_pct) {
        mistakeRate *= (1 + window.intensity);
      }
    }

    return rng.next() < mistakeRate;
  }

  private calculateDramaModifier(plan: OpponentPlan, gameState: any, rng: any): number {
    // Drama modifies probabilities, not results
    let modifier = 0;

    switch (plan.drama_archetype) {
      case 'close_win':
        if (gameState.playerScore < gameState.opponentScore) {
          modifier = -50; // Help player catch up
        }
        break;
      case 'close_loss':
        if (gameState.playerScore > gameState.opponentScore) {
          modifier = 50; // Help opponent catch up
        }
        break;
      case 'comeback':
        if (gameState.isLateGame && gameState.playerScore < gameState.opponentScore) {
          modifier = -100; // Big comeback opportunity
        }
        break;
      case 'control_win':
        // No significant modifiers
        break;
      case 'stomp_rare':
        if (rng.next() < 0.2) { // 20% chance
          modifier = gameState.playerScore > gameState.opponentScore ? 100 : -100;
        }
        break;
    }

    // Apply risk bounds
    modifier = Math.max(-plan.risk_bounds.max_loss_bias * 1000, 
                       Math.min(plan.risk_bounds.max_win_bias * 1000, modifier));

    return modifier;
  }

  // Admin dashboard methods
  async getGovernanceStats() {
    if (!this.supabase) {
      return {
        total_plans: 0,
        tier_distribution: { TIER1: 0, TIER2: 0, FALLBACK: 0, BLOCKED: 0 },
        persona_distribution: { Aggro: 0, Turtle: 0, Counter: 0, Gambler: 0 },
        drama_distribution: {
          close_win: 0,
          close_loss: 0,
          comeback: 0,
          control_win: 0,
          stomp_rare: 0,
        },
        average_latency: 0,
        average_cost: 0,
        circuit_breaker_status: this.circuitBreaker.getStatus(),
      };
    }
    try {
      const { data } = await this.supabase
        .from('match_opponent_plans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      return {
        total_plans: data?.length || 0,
        tier_distribution: this.calculateTierDistribution(data),
        persona_distribution: this.calculatePersonaDistribution(data),
        drama_distribution: this.calculateDramaDistribution(data),
        average_latency: this.calculateAverageLatency(data),
        average_cost: this.calculateAverageCost(data),
        circuit_breaker_status: this.circuitBreaker.getStatus()
      };
    } catch (error) {
      console.error('Failed to get governance stats:', error);
      return null;
    }
  }

  private calculateTierDistribution(data: any[]) {
    const distribution = { TIER1: 0, TIER2: 0, FALLBACK: 0, BLOCKED: 0 };
    data.forEach(item => {
      const tier = item.governance_tier;
      if (tier in distribution) distribution[tier as keyof typeof distribution]++;
    });
    return distribution;
  }

  private calculatePersonaDistribution(data: any[]) {
    const distribution = { Aggro: 0, Turtle: 0, Counter: 0, Gambler: 0 };
    data.forEach(item => {
      const persona = item.persona;
      if (persona in distribution) distribution[persona as keyof typeof distribution]++;
    });
    return distribution;
  }

  private calculateDramaDistribution(data: any[]) {
    const distribution = { close_win: 0, close_loss: 0, comeback: 0, control_win: 0, stomp_rare: 0 };
    data.forEach(item => {
      const drama = item.drama_archetype;
      if (drama in distribution) distribution[drama as keyof typeof distribution]++;
    });
    return distribution;
  }

  private calculateAverageLatency(data: any[]) {
    if (!data.length) return 0;
    const total = data.reduce((sum, item) => sum + (item.latency_ms || 0), 0);
    return Math.round(total / data.length);
  }

  private calculateAverageCost(data: any[]) {
    if (!data.length) return 0;
    const total = data.reduce((sum, item) => sum + (item.cost_per_plan || 0), 0);
    return total / data.length;
  }
}

// Supporting Classes

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      console.warn('Circuit breaker opened due to repeated failures');
    }
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

class TelemetryEmitter {
  async emitEvent(eventType: string, data: any) {
    // Emit structured backend events
    console.log(`TELEMETRY: ${eventType}`, data);
    
    // In production, this would send to your telemetry system
    // await this.sendToTelemetryService(eventType, data);
  }

  async emitTTFM(queueEnterTime: number, matchStartTime: number) {
    const ttfm = matchStartTime - queueEnterTime;
    await this.emitEvent('TTFM', { duration_ms: ttfm });
  }

  async emitRematchRate(rematchOffers: number, rematchAccepts: number) {
    const rate = rematchOffers > 0 ? rematchAccepts / rematchOffers : 0;
    await this.emitEvent('REMATCH_RATE', { rate });
  }

  async emitRageQuit(matchData: any) {
    await this.emitEvent('RAGE_QUIT', matchData);
  }
}

class FairnessMonitor {
  private recentMatches: any[] = [];

  recordMatch(matchData: any) {
    this.recentMatches.push(matchData);
    
    // Keep only last 1000 matches
    if (this.recentMatches.length > 1000) {
      this.recentMatches.shift();
    }

    // Check for fairness violations
    this.checkFairnessViolations();
  }

  private checkFairnessViolations() {
    if (this.recentMatches.length < 100) return;

    // Check win rate deviation
    const winRate = this.calculateWinRate();
    if (Math.abs(winRate - 0.5) > 0.07) {
      console.warn(`Win rate deviation detected: ${winRate}`);
      // Trigger governance review
    }

    // Check close match clustering
    const closeMatchRate = this.calculateCloseMatchRate();
    if (closeMatchRate > 0.65) {
      console.warn(`Close match clustering detected: ${closeMatchRate}`);
      // Trigger audit
    }

    // Check comeback clustering
    const comebackRate = this.calculateComebackRate();
    if (comebackRate > 0.15) {
      console.warn(`Comeback clustering detected: ${comebackRate}`);
      // Trigger audit
    }
  }

  private calculateWinRate(): number {
    const wins = this.recentMatches.filter(m => m.result === 'win').length;
    return wins / this.recentMatches.length;
  }

  private calculateCloseMatchRate(): number {
    const closeMatches = this.recentMatches.filter(m => m.isCloseMatch).length;
    return closeMatches / this.recentMatches.length;
  }

  private calculateComebackRate(): number {
    const comebacks = this.recentMatches.filter(m => m.isComeback).length;
    return comebacks / this.recentMatches.length;
  }
}
