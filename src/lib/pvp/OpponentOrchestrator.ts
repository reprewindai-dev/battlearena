import { BotOpponent, selectBotOpponent } from "@/lib/ai/bot-opponent";

export interface OpponentProfile {
  id: string;
  name: string;
  avatar: string;
  rank: string;
  badge: string;
  mmr: number;
  winRate: number;
  streak: number;
  lastSeen?: string;
  persona: 'aggressive' | 'turtle' | 'counterpunch' | 'gambler' | 'clipper_hunter';
  isLive: boolean;
  isGhost: boolean;
  isBot: boolean;
}

export interface MatchTiming {
  searchTime: number; // 1.3-4.8s
  connectTime: number; // 0.7-1.2s
  reactionDelay: number; // varies by persona
  hesitationEvents: number; // 8-15% per match
}

export interface DramaCurve {
  type: 'open_loss' | 'control_win' | 'close_win' | 'close_loss' | 'comeback';
  targetShape: number; // 0-1 probability curve
  riskTolerance: number;
  mistakeProbability: number;
  aggressiveness: number;
}

export interface HumanizationFilterSet {
  timingRealism: {
    reactionDelay: number;
    hesitationSpikes: number[];
    inputJitter: number;
  };
  errorModel: {
    microMistakes: number[];
    lateGameNerves: boolean;
    overcommit: boolean;
  };
  adaptation: {
    counterThreshold: number;
    adaptationDelay: number;
  };
}

export class OpponentOrchestrator {
  private dramaCurveController: DramaCurveController;
  private humanizationFilters: HumanizationFilters;
  private telemetryEngine: TelemetryEngine;

  constructor() {
    this.dramaCurveController = new DramaCurveController();
    this.humanizationFilters = new HumanizationFilters();
    this.telemetryEngine = new TelemetryEngine();
  }

  async findOpponent(playerId: string, playerMMR: number, preferredMode: string): Promise<{
    opponent: OpponentProfile;
    timing: MatchTiming;
    dramaCurve: DramaCurve;
  }> {
    // Step 1: Try live match for 4 seconds
    const liveOpponent = await this.tryLiveMatch(playerId, playerMMR, 4000);
    if (liveOpponent) {
      return {
        opponent: liveOpponent,
        timing: this.generateMatchTiming('live'),
        dramaCurve: this.dramaCurveController.generateCurve(playerMMR, 'live')
      };
    }

    // Step 2: Try Ghost match
    const ghostOpponent = await this.tryGhostMatch(playerId, playerMMR);
    if (ghostOpponent) {
      return {
        opponent: ghostOpponent,
        timing: this.generateMatchTiming('ghost'),
        dramaCurve: this.dramaCurveController.generateCurve(playerMMR, 'ghost')
      };
    }

    // Step 3: Fall back to AI bot
    const botOpponent = await this.createBotOpponent(playerId, playerMMR);
    return {
      opponent: botOpponent,
      timing: this.generateMatchTiming('bot'),
      dramaCurve: this.dramaCurveController.generateCurve(playerMMR, 'bot')
    };
  }

  private async tryLiveMatch(playerId: string, playerMMR: number, timeoutMs: number): Promise<OpponentProfile | null> {
    // Simulate live matchmaking attempt
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      // In real implementation, this would query matchmaking service
      const liveMatch = await this.queryLiveMatchmaking(playerId, playerMMR);
      if (liveMatch) {
        return {
          ...liveMatch,
          isLive: true,
          isGhost: false,
          isBot: false
        };
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return null;
  }

  private async tryGhostMatch(playerId: string, playerMMR: number): Promise<OpponentProfile | null> {
    // Query ghost library for similar MMR players
    const ghost = await this.queryGhostLibrary(playerId, playerMMR);
    if (ghost) {
      return {
        ...ghost,
        isLive: false,
        isGhost: true,
        isBot: false
      };
    }
    return null;
  }

  private async createBotOpponent(playerId: string, playerMMR: number): Promise<OpponentProfile> {
    const botPersonality = selectBotOpponent(playerMMR);
    const persona = this.selectPersona(playerMMR);
    
    return {
      id: `bot_${botPersonality.id}_${Date.now()}`,
      name: botPersonality.name,
      avatar: botPersonality.avatar,
      rank: this.getRankFromMMR(playerMMR),
      badge: this.getBadgeFromMMR(playerMMR),
      mmr: playerMMR + Math.floor(Math.random() * 200 - 100), // +/- 100 MMR
      winRate: 0.45 + Math.random() * 0.2, // 45-65%
      streak: Math.floor(Math.random() * 10 - 5), // -5 to +5
      persona,
      isLive: false,
      isGhost: false,
      isBot: true
    };
  }

  private selectPersona(mmr: number): 'aggressive' | 'turtle' | 'counterpunch' | 'gambler' | 'clipper_hunter' {
    const personas: Array<'aggressive' | 'turtle' | 'counterpunch' | 'gambler' | 'clipper_hunter'> = 
      ['aggressive', 'turtle', 'counterpunch', 'gambler', 'clipper_hunter'];
    
    // Higher MMR players get more diverse personas
    if (mmr < 1200) {
      return Math.random() < 0.6 ? 'aggressive' : 'turtle';
    } else if (mmr < 1600) {
      return personas[Math.floor(Math.random() * 4)];
    } else {
      return personas[Math.floor(Math.random() * personas.length)];
    }
  }

  private getRankFromMMR(mmr: number): string {
    if (mmr < 1000) return 'Bronze';
    if (mmr < 1200) return 'Silver';
    if (mmr < 1400) return 'Gold';
    if (mmr < 1600) return 'Platinum';
    if (mmr < 1800) return 'Diamond';
    return 'Master';
  }

  private getBadgeFromMMR(mmr: number): string {
    const badges = ['🥉', '🥈', '🥇', '💎', '👑', '🌟'];
    const index = Math.min(Math.floor(mmr / 300), badges.length - 1);
    return badges[index];
  }

  private generateMatchTiming(opponentType: 'live' | 'ghost' | 'bot'): MatchTiming {
    const searchTime = 1300 + Math.random() * 3500; // 1.3-4.8s
    const connectTime = 700 + Math.random() * 500; // 0.7-1.2s
    
    // Reaction delays vary by persona
    const reactionDelay = this.getReactionDelayForPersona();
    const hesitationEvents = Math.random() < 0.12 ? 1 : 0; // 8-15% chance

    return {
      searchTime,
      connectTime,
      reactionDelay,
      hesitationEvents
    };
  }

  private getReactionDelayForPersona(): number {
    const persona = this.selectPersona(1500); // Default mid-tier for timing
    
    switch (persona) {
      case 'aggressive':
        return 180 + Math.random() * 240; // 180-420ms (fast)
      case 'turtle':
        return 320 + Math.random() * 330; // 320-650ms (slow)
      case 'counterpunch':
        return 250 + Math.random() * 270; // 250-520ms (medium)
      case 'gambler':
        return 200 + Math.random() * 300; // 200-500ms (variable)
      case 'clipper_hunter':
        return 280 + Math.random() * 340; // 280-620ms (controlled)
      default:
        return 250 + Math.random() * 270;
    }
  }

  private async queryLiveMatchmaking(playerId: string, playerMMR: number): Promise<any> {
    // In real implementation, this would query the matchmaking service
    // For now, return null to simulate no live players
    return null;
  }

  private async queryGhostLibrary(playerId: string, playerMMR: number): Promise<any> {
    // In real implementation, this would query the ghost library service
    // For now, return null to simulate no ghosts available
    return null;
  }

  // Public interface for getting opponent actions
  getNextAction(gameState: any, currentTime: number): {
    action: any;
    delay: number;
    confidence: number;
  } {
    const humanizedAction = this.humanizationFilters.applyFilters(gameState, currentTime);
    return humanizedAction;
  }

  // Telemetry integration
  recordMatchResult(playerId: string, result: 'win' | 'loss', matchData: any) {
    this.telemetryEngine.recordMatch(playerId, result, matchData);
  }

  adjustDifficulty(playerId: string, feedback: any) {
    this.telemetryEngine.adjustDifficulty(playerId, feedback);
  }
}

class DramaCurveController {
  generateCurve(playerMMR: number, opponentType: 'live' | 'ghost' | 'bot'): DramaCurve {
    const rand = Math.random();
    
    // Drama curve distribution
    let type: DramaCurve['type'];
    if (rand < 0.20) type = 'open_loss';
    else if (rand < 0.45) type = 'control_win';
    else if (rand < 0.70) type = 'close_win';
    else if (rand < 0.90) type = 'close_loss';
    else type = 'comeback';

    // Adjust difficulty based on opponent type
    const difficultyMultiplier = opponentType === 'bot' ? 0.8 : 1.0;
    
    return {
      type,
      targetShape: this.generateTargetShape(type),
      riskTolerance: (0.3 + Math.random() * 0.4) * difficultyMultiplier,
      mistakeProbability: this.getMistakeProbability(type, playerMMR),
      aggressiveness: this.getAggressiveness(type, playerMMR)
    };
  }

  private generateTargetShape(type: DramaCurve['type']): number {
    const shapes = {
      open_loss: 0.2,
      control_win: 0.7,
      close_win: 0.55,
      close_loss: 0.45,
      comeback: 0.3
    };
    return shapes[type];
  }

  private getMistakeProbability(type: DramaCurve['type'], playerMMR: number): number {
    const base = {
      open_loss: 0.1,
      control_win: 0.15,
      close_win: 0.25,
      close_loss: 0.35,
      comeback: 0.4
    };
    
    // Higher MMR opponents make fewer mistakes
    const mmrModifier = Math.max(0.5, 1 - (playerMMR - 1000) / 2000);
    return base[type] * mmrModifier;
  }

  private getAggressiveness(type: DramaCurve['type'], playerMMR: number): number {
    const base = {
      open_loss: 0.8,
      control_win: 0.4,
      close_win: 0.6,
      close_loss: 0.7,
      comeback: 0.9
    };
    
    return base[type];
  }
}

class HumanizationFilters {
  applyFilters(gameState: any, currentTime: number): {
    action: any;
    delay: number;
    confidence: number;
  } {
    // Apply timing realism
    const delay = this.applyTimingRealism(gameState);
    
    // Apply error model
    const action = this.applyErrorModel(gameState);
    
    // Calculate confidence based on game state
    const confidence = this.calculateConfidence(gameState);
    
    return { action, delay, confidence };
  }

  private applyTimingRealism(gameState: any): number {
    const baseDelay = 250 + Math.random() * 200; // 250-450ms base
    
    // Add hesitation spikes
    if (Math.random() < 0.12) {
      return baseDelay + 250 + Math.random() * 650; // +250-900ms hesitation
    }
    
    // Add input jitter
    const jitter = (Math.random() - 0.5) * 50; // +/-25ms jitter
    return baseDelay + jitter;
  }

  private applyErrorModel(gameState: any): any {
    // In real implementation, this would modify the action based on error model
    // For now, return the action as-is
    return gameState.suggestedAction;
  }

  private calculateConfidence(gameState: any): number {
    // Base confidence on game state and opponent skill
    const baseConfidence = 0.7 + Math.random() * 0.2; // 70-90%
    
    // Reduce confidence under pressure
    if (gameState.isCloseMatch && gameState.isLateGame) {
      return baseConfidence * 0.8; // 20% reduction under pressure
    }
    
    return baseConfidence;
  }
}

class TelemetryEngine {
  private playerData: Map<string, any> = new Map();

  recordMatch(playerId: string, result: 'win' | 'loss', matchData: any) {
    const data = this.playerData.get(playerId) || {
      sessions: [],
      averageSessionLength: 0,
      rematches: 0,
      churnRisk: 0
    };

    data.sessions.push({
      result,
      timestamp: Date.now(),
      matchData
    });

    // Update metrics
    this.updateMetrics(playerId, data);
    this.playerData.set(playerId, data);
  }

  adjustDifficulty(playerId: string, feedback: any) {
    const data = this.playerData.get(playerId);
    if (!data) return;

    // Adjust difficulty based on feedback
    if (feedback.tooEasy) {
      data.difficultyAdjustment = (data.difficultyAdjustment || 0) + 0.1;
    } else if (feedback.tooHard) {
      data.difficultyAdjustment = (data.difficultyAdjustment || 0) - 0.1;
    }

    this.playerData.set(playerId, data);
  }

  private updateMetrics(playerId: string, data: any) {
    // Calculate session length
    const recentSessions = data.sessions.slice(-10);
    if (recentSessions.length >= 2) {
      const sessionLength = recentSessions[recentSessions.length - 1].timestamp - recentSessions[0].timestamp;
      data.averageSessionLength = sessionLength;
    }

    // Calculate churn risk
    const recentLosses = recentSessions.filter((s: { result: 'win' | 'loss' }) => s.result === 'loss').length;
    data.churnRisk = recentLosses / recentSessions.length;
  }

  getPlayerMetrics(playerId: string) {
    return this.playerData.get(playerId);
  }
}
