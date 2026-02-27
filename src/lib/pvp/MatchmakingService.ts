import { OpponentOrchestrator, OpponentProfile, MatchTiming } from './OpponentOrchestrator';

export interface MatchmakingRequest {
  playerId: string;
  skillEstimate: number;
  preferredMode: 'ranked' | 'casual';
  latencyRegion: string;
}

export interface MatchResult {
  matchId: string;
  opponentProfile: OpponentProfile;
  opponentType: 'live' | 'ghost' | 'bot';
  seed: number;
  pacingPlan: MatchTiming;
}

export class MatchmakingService {
  private orchestrator: OpponentOrchestrator;
  private activeMatches: Map<string, any> = new Map();

  constructor() {
    this.orchestrator = new OpponentOrchestrator();
  }

  async findMatch(request: MatchmakingRequest): Promise<MatchResult> {
    console.log(`🔍 Finding match for player ${request.playerId} (${request.skillEstimate} MMR)`);

    // Step 1: Try live match for 4 seconds
    console.log('⏱️ Searching for live opponents...');
    const liveResult = await this.tryLiveMatch(request, 4000);
    if (liveResult) {
      console.log('✅ Live opponent found!');
      return liveResult;
    }

    // Step 2: Try Ghost if appropriate ghost exists
    console.log('👻 No live opponent, trying ghost match...');
    const ghostResult = await this.tryGhostMatch(request);
    if (ghostResult) {
      console.log('✅ Ghost opponent found!');
      return ghostResult;
    }

    // Step 3: Fall back to AI bot
    console.log('🤖 No ghost available, creating AI bot...');
    const botResult = await this.createBotMatch(request);
    console.log('✅ AI bot created!');
    return botResult;
  }

  private async tryLiveMatch(request: MatchmakingRequest, timeoutMs: number): Promise<MatchResult | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      // Query live matchmaking pool
      const liveOpponent = await this.queryLivePool(request);
      if (liveOpponent) {
        const matchId = this.generateMatchId();
        const matchResult: MatchResult = {
          matchId,
          opponentProfile: {
            ...liveOpponent,
            isLive: true,
            isGhost: false,
            isBot: false
          },
          opponentType: 'live',
          seed: Math.random(),
          pacingPlan: await this.orchestrator['generateMatchTiming']('live')
        };

        this.activeMatches.set(matchId, {
          type: 'live',
          players: [request.playerId, liveOpponent.id],
          startTime: Date.now()
        });

        return matchResult;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return null;
  }

  private async tryGhostMatch(request: MatchmakingRequest): Promise<MatchResult | null> {
    const ghostOpponent = await this.queryGhostLibrary(request);
    if (!ghostOpponent) return null;

    const matchId = this.generateMatchId();
    const matchResult: MatchResult = {
      matchId,
      opponentProfile: {
        ...ghostOpponent,
        isLive: false,
        isGhost: true,
        isBot: false
      },
      opponentType: 'ghost',
      seed: Math.random(),
      pacingPlan: await this.orchestrator['generateMatchTiming']('ghost')
    };

    this.activeMatches.set(matchId, {
      type: 'ghost',
      players: [request.playerId, ghostOpponent.id],
      startTime: Date.now()
    });

    return matchResult;
  }

  private async createBotMatch(request: MatchmakingRequest): Promise<MatchResult> {
    const botOpponent = await this.orchestrator['createBotOpponent'](request.playerId, request.skillEstimate);
    
    const matchId = this.generateMatchId();
    const matchResult: MatchResult = {
      matchId,
      opponentProfile: botOpponent,
      opponentType: 'bot',
      seed: Math.random(),
      pacingPlan: await this.orchestrator['generateMatchTiming']('bot')
    };

    this.activeMatches.set(matchId, {
      type: 'bot',
      players: [request.playerId, botOpponent.id],
      startTime: Date.now()
    });

    return matchResult;
  }

  private async queryLivePool(request: MatchmakingRequest): Promise<any> {
    // In real implementation, this would query the live matchmaking pool
    // For now, simulate no live players available
    return null;
  }

  private async queryGhostLibrary(request: MatchmakingRequest): Promise<any> {
    // In real implementation, this would query the ghost library service
    // For now, simulate no ghosts available
    return null;
  }

  private generateMatchId(): string {
    return `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get match status
  getMatchStatus(matchId: string): any {
    return this.activeMatches.get(matchId);
  }

  // End match and record results
  endMatch(matchId: string, result: 'win' | 'loss', playerData: any) {
    const match = this.activeMatches.get(matchId);
    if (!match) return;

    // Record telemetry
    this.orchestrator.recordMatchResult(match.players[0], result, {
      matchId,
      opponentType: match.type,
      duration: Date.now() - match.startTime,
      ...playerData
    });

    // Clean up
    this.activeMatches.delete(matchId);
  }

  // Get active matches count
  getActiveMatchesCount(): number {
    return this.activeMatches.size;
  }

  // Get matchmaking statistics
  getStats(): any {
    const matches = Array.from(this.activeMatches.values());
    
    return {
      totalActive: matches.length,
      liveMatches: matches.filter(m => m.type === 'live').length,
      ghostMatches: matches.filter(m => m.type === 'ghost').length,
      botMatches: matches.filter(m => m.type === 'bot').length,
      averageMatchDuration: matches.reduce((sum, m) => sum + (Date.now() - m.startTime), 0) / matches.length || 0
    };
  }
}
