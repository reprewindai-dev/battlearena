import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface MatchEvent {
  seq: number;
  t_ms: number;
  actor: 'player_a' | 'player_b' | 'server' | 'bot';
  event_type: 'MATCH_START' | 'PLAYER_INPUT' | 'OPPONENT_ACTION' | 'SCORE_CHANGE' | 'STATE_SNAPSHOT' | 'MATCH_END' | 'ROUND_START' | 'ROUND_END';
  payload: any;
}

export interface MatchRecording {
  match_id: string;
  mode: 'ranked' | 'casual';
  region: string;
  player_a_id: string;
  player_b_id?: string;
  player_a_mmr: number;
  player_b_mmr?: number;
  winner?: string;
  duration_ms: number;
  summary: any;
  events: MatchEvent[];
  is_bot_match: boolean;
  bot_personality_id?: string;
  governance_tier?: string;
  opponent_plan_id?: string;
  event_stream_hash?: string;
  server_signature?: string;
}

export interface GhostPattern {
  player_id: string;
  recording_match_id: string;
  player_mmr_at_time: number;
  skill_band: 'easy' | 'mid' | 'hard';
  playstyle_tags: string[];
  reaction_time_avg_ms: number;
  reaction_time_std_ms: number;
  mistake_rate: number;
  aggression_score: number;
  adaptation_score: number;
  opening_patterns: any[];
  response_patterns: any[];
  pressure_responses: any[];
  recording_quality_score: number;
}

export class GhostRecordingSystem {
  private supabase: any;
  private eventBuffer: Map<string, MatchEvent[]> = new Map();
  private recordingSessions: Map<string, MatchRecording> = new Map();

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // Start recording a match
  async startRecording(recording: Omit<MatchRecording, 'events' | 'duration_ms'>): Promise<string> {
    const match_id = recording.match_id;
    
    // Initialize recording session
    const fullRecording: MatchRecording = {
      ...recording,
      events: [],
      duration_ms: 0
    };

    this.recordingSessions.set(match_id, fullRecording);
    this.eventBuffer.set(match_id, []);

    // Record MATCH_START event
    await this.recordEvent(match_id, {
      t_ms: 0,
      actor: 'server',
      event_type: 'MATCH_START',
      payload: {
        mode: recording.mode,
        region: recording.region,
        player_a_id: recording.player_a_id,
        player_b_id: recording.player_b_id,
        player_a_mmr: recording.player_a_mmr,
        player_b_mmr: recording.player_b_mmr,
        is_bot_match: recording.is_bot_match,
        bot_personality_id: recording.bot_personality_id,
        governance_tier: recording.governance_tier
      }
    });

    console.log(`📹 Started recording match: ${match_id}`);
    return match_id;
  }

  // Record an event during the match
  async recordEvent(match_id: string, event: Omit<MatchEvent, 'seq'>): Promise<void> {
    const buffer = this.eventBuffer.get(match_id);
    if (!buffer) {
      console.warn(`No recording session found for match: ${match_id}`);
      return;
    }

    // Assign sequence number
    const seq = buffer.length;
    const fullEvent: MatchEvent = { ...event, seq };

    // Add to buffer
    buffer.push(fullEvent);

    // Periodically flush to database (every 10 events or every 5 seconds)
    if (buffer.length >= 10 || (buffer.length > 0 && Date.now() % 5000 < 100)) {
      await this.flushEvents(match_id);
    }
  }

  // Record player input
  async recordPlayerInput(match_id: string, player_id: string, inputData: any): Promise<void> {
    await this.recordEvent(match_id, {
      t_ms: Date.now(),
      actor: player_id === this.recordingSessions.get(match_id)?.player_a_id ? 'player_a' : 'player_b',
      event_type: 'PLAYER_INPUT',
      payload: inputData
    });
  }

  // Record opponent action
  async recordOpponentAction(match_id: string, actionData: any): Promise<void> {
    await this.recordEvent(match_id, {
      t_ms: Date.now(),
      actor: this.recordingSessions.get(match_id)?.is_bot_match ? 'bot' : 'player_b',
      event_type: 'OPPONENT_ACTION',
      payload: actionData
    });
  }

  // Record score change
  async recordScoreChange(match_id: string, player_a_score: number, player_b_score: number): Promise<void> {
    await this.recordEvent(match_id, {
      t_ms: Date.now(),
      actor: 'server',
      event_type: 'SCORE_CHANGE',
      payload: { player_a_score, player_b_score }
    });
  }

  // Record state snapshot
  async recordStateSnapshot(match_id: string, gameState: any): Promise<void> {
    await this.recordEvent(match_id, {
      t_ms: Date.now(),
      actor: 'server',
      event_type: 'STATE_SNAPSHOT',
      payload: gameState
    });
  }

  // End recording and save to database
  async endRecording(match_id: string, winner?: string, finalScores?: {player_a: number, player_b: number}): Promise<void> {
    const recording = this.recordingSessions.get(match_id);
    if (!recording) {
      console.warn(`No recording session found for match: ${match_id}`);
      return;
    }

    // Flush remaining events
    await this.flushEvents(match_id);

    // Record MATCH_END event
    await this.recordEvent(match_id, {
      t_ms: Date.now(),
      actor: 'server',
      event_type: 'MATCH_END',
      payload: {
        winner,
        final_scores: finalScores,
        duration_ms: Date.now() - recording.events[0]?.t_ms || 0
      }
    });

    // Final flush
    await this.flushEvents(match_id);

    // Calculate final duration and save match replay
    const events = this.eventBuffer.get(match_id) || [];
    const duration_ms = events.length > 0 ? events[events.length - 1].t_ms - events[0].t_ms : 0;

    // Generate event stream hash and server signature
    const eventStreamHash = this.generateEventStreamHash(events);
    const serverSignature = this.generateServerSignature(eventStreamHash);

    // Save to database
    await this.saveMatchReplay({
      ...recording,
      duration_ms,
      summary: this.generateMatchSummary(events),
      event_stream_hash: eventStreamHash,
      server_signature: serverSignature
    }, events);

    // Process for ghost library if it's a human vs human match
    if (!recording.is_bot_match && recording.player_b_id) {
      await this.processForGhostLibrary(recording, events);
    }

    // Clean up
    this.recordingSessions.delete(match_id);
    this.eventBuffer.delete(match_id);

    console.log(`📹 Finished recording match: ${match_id} (${events.length} events, ${duration_ms}ms)`);
  }

  // Flush events to database
  private async flushEvents(match_id: string): Promise<void> {
    const events = this.eventBuffer.get(match_id);
    if (!events || events.length === 0) return;

    try {
      // Insert events in batch
      const { error } = await this.supabase.from('match_replay_events').insert(
        events.map(event => ({
          match_id,
          seq: event.seq,
          t_ms: event.t_ms,
          actor: event.actor,
          event_type: event.event_type,
          payload_json: event.payload
        }))
      );

      if (error) {
        console.error('Failed to flush events:', error);
        return;
      }

      // Clear flushed events
      const remainingEvents = events.slice(-5); // Keep last 5 events in buffer
      this.eventBuffer.set(match_id, remainingEvents);

    } catch (error) {
      console.error('Error flushing events:', error);
    }
  }

  // Save match replay to database
  private async saveMatchReplay(recording: MatchRecording, events: MatchEvent[]): Promise<void> {
    try {
      const { error } = await this.supabase.from('match_replays').insert({
        match_id: recording.match_id,
        mode: recording.mode,
        region: recording.region,
        player_a_id: recording.player_a_id,
        player_b_id: recording.player_b_id,
        player_a_mmr: recording.player_a_mmr,
        player_b_mmr: recording.player_b_mmr,
        winner: recording.winner,
        duration_ms: recording.duration_ms,
        summary_json: recording.summary,
        event_stream_hash: recording.event_stream_hash || '',
        server_signature: recording.server_signature || '',
        is_bot_match: recording.is_bot_match,
        bot_personality_id: recording.bot_personality_id,
        governance_tier: recording.governance_tier,
        opponent_plan_id: recording.opponent_plan_id
      });

      if (error) {
        console.error('Failed to save match replay:', error);
      }

    } catch (error) {
      console.error('Error saving match replay:', error);
    }
  }

  // Process recording for ghost library
  private async processForGhostLibrary(recording: MatchRecording, events: MatchEvent[]): Promise<void> {
    // Analyze both players' patterns
    await this.analyzePlayerForGhost(recording.player_a_id, recording.player_a_mmr, events, 'player_a');
    
    if (recording.player_b_id) {
      await this.analyzePlayerForGhost(recording.player_b_id, recording.player_b_mmr || 0, events, 'player_b');
    }
  }

  // Analyze player patterns for ghost library
  private async analyzePlayerForGhost(
    player_id: string, 
    player_mmr: number, 
    events: MatchEvent[], 
    actor: 'player_a' | 'player_b'
  ): Promise<void> {
    const playerEvents = events.filter(e => e.actor === actor && e.event_type === 'PLAYER_INPUT');
    
    if (playerEvents.length < 5) {
      console.log(`Insufficient events for ghost analysis: ${player_id}`);
      return;
    }

    // Calculate metrics
    const skill_band = player_mmr < 1200 ? 'easy' : player_mmr < 1800 ? 'mid' : 'hard';
    
    // Reaction time analysis
    const reactionTimes = this.calculateReactionTimes(events, actor);
    const reaction_time_avg_ms = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length;
    const reaction_time_std_ms = this.calculateStandardDeviation(reactionTimes);

    // Mistake rate analysis
    const mistake_rate = this.calculateMistakeRate(events, actor);

    // Aggression and adaptation scores
    const aggression_score = this.calculateAggressionScore(events, actor);
    const adaptation_score = this.calculateAdaptationScore(events, actor);

    // Pattern analysis
    const opening_patterns = this.extractOpeningPatterns(events, actor);
    const response_patterns = this.extractResponsePatterns(events, actor);
    const pressure_responses = this.extractPressureResponses(events, actor);

    // Playstyle tags
    const playstyle_tags = this.generatePlaystyleTags(aggression_score, adaptation_score, mistake_rate);

    // Recording quality score
    const recording_quality_score = this.calculateRecordingQuality(events, actor);

    const ghostPattern: GhostPattern = {
      player_id,
      recording_match_id: String(events[0]?.payload?.match_id ?? ''),
      player_mmr_at_time: player_mmr,
      skill_band,
      playstyle_tags,
      reaction_time_avg_ms,
      reaction_time_std_ms,
      mistake_rate,
      aggression_score,
      adaptation_score,
      opening_patterns,
      response_patterns,
      pressure_responses,
      recording_quality_score
    };

    // Save to ghost library
    await this.saveGhostPattern(ghostPattern);
  }

  // Analysis helper methods
  private calculateReactionTimes(events: MatchEvent[], actor: 'player_a' | 'player_b'): number[] {
    const reactionTimes: number[] = [];
    let lastOpponentAction = 0;

    for (const event of events) {
      if (event.actor !== actor && event.event_type === 'OPPONENT_ACTION') {
        lastOpponentAction = event.t_ms;
      } else if (event.actor === actor && event.event_type === 'PLAYER_INPUT' && lastOpponentAction > 0) {
        reactionTimes.push(event.t_ms - lastOpponentAction);
        lastOpponentAction = 0;
      }
    }

    return reactionTimes;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateMistakeRate(events: MatchEvent[], actor: 'player_a' | 'player_b'): number {
    const playerInputs = events.filter(e => e.actor === actor && e.event_type === 'PLAYER_INPUT');
    const mistakes = playerInputs.filter(e => e.payload.is_mistake === true).length;
    return mistakes / playerInputs.length;
  }

  private calculateAggressionScore(events: MatchEvent[], actor: 'player_a' | 'player_b'): number {
    const playerInputs = events.filter(e => e.actor === actor && e.event_type === 'PLAYER_INPUT');
    const aggressiveActions = playerInputs.filter(e => e.payload.aggression_level > 0.7).length;
    return aggressiveActions / playerInputs.length;
  }

  private calculateAdaptationScore(events: MatchEvent[], actor: 'player_a' | 'player_b'): number {
    // Simple adaptation score based on pattern variation
    const playerInputs = events.filter(e => e.actor === actor && e.event_type === 'PLAYER_INPUT');
    const patterns = new Set(playerInputs.map(e => e.payload.pattern_type));
    return Math.min(1, patterns.size / 10); // Normalize to 0-1
  }

  private extractOpeningPatterns(events: MatchEvent[], actor: 'player_a' | 'player_b'): any[] {
    const firstThreeInputs = events.filter(e => e.actor === actor && e.event_type === 'PLAYER_INPUT').slice(0, 3);
    return firstThreeInputs.map(e => ({
      pattern_type: e.payload.pattern_type,
      timing: e.t_ms,
      aggression: e.payload.aggression_level
    }));
  }

  private extractResponsePatterns(events: MatchEvent[], actor: 'player_a' | 'player_b'): any[] {
    const patterns: any[] = [];
    let lastOpponentAction: any = null;

    for (const event of events) {
      if (event.actor !== actor && event.event_type === 'OPPONENT_ACTION') {
        lastOpponentAction = event.payload;
      } else if (event.actor === actor && event.event_type === 'PLAYER_INPUT' && lastOpponentAction) {
        patterns.push({
          opponent_action: lastOpponentAction,
          response: event.payload,
          timing: event.t_ms
        });
        lastOpponentAction = null;
      }
    }

    return patterns;
  }

  private extractPressureResponses(events: MatchEvent[], actor: 'player_a' | 'player_b'): any[] {
    const pressureEvents = events.filter(e => e.payload.is_under_pressure === true);
    return pressureEvents.map(e => ({
      event: e.payload,
      response_timing: e.t_ms,
      success: e.payload.successful_response
    }));
  }

  private generatePlaystyleTags(aggression: number, adaptation: number, mistakeRate: number): string[] {
    const tags: string[] = [];

    if (aggression > 0.7) tags.push('aggressive');
    else if (aggression < 0.3) tags.push('defensive');

    if (adaptation > 0.7) tags.push('adaptive');
    else if (adaptation < 0.3) tags.push('predictable');

    if (mistakeRate > 0.1) tags.push('error_prone');
    else if (mistakeRate < 0.05) tags.push('precise');

    return tags;
  }

  private calculateRecordingQuality(events: MatchEvent[], actor: 'player_a' | 'player_b'): number {
    const playerEvents = events.filter(e => e.actor === actor);
    
    // Quality factors
    const eventCount = playerEvents.length;
    const hasTiming = playerEvents.every(e => e.t_ms > 0);
    const hasPayload = playerEvents.every(e => e.payload && Object.keys(e.payload).length > 0);

    let quality = 0.5; // Base quality

    if (eventCount >= 10) quality += 0.2;
    if (eventCount >= 20) quality += 0.1;
    if (hasTiming) quality += 0.1;
    if (hasPayload) quality += 0.1;

    return Math.min(1, quality);
  }

  // Save ghost pattern to library
  private async saveGhostPattern(pattern: GhostPattern): Promise<void> {
    try {
      const { error } = await this.supabase.from('ghost_library').insert({
        player_id: pattern.player_id,
        recording_match_id: pattern.recording_match_id,
        player_mmr_at_time: pattern.player_mmr_at_time,
        skill_band: pattern.skill_band,
        playstyle_tags: pattern.playstyle_tags,
        reaction_time_avg_ms: pattern.reaction_time_avg_ms,
        reaction_time_std_ms: pattern.reaction_time_std_ms,
        mistake_rate: pattern.mistake_rate,
        aggression_score: pattern.aggression_score,
        adaptation_score: pattern.adaptation_score,
        opening_patterns: pattern.opening_patterns,
        response_patterns: pattern.response_patterns,
        pressure_responses: pattern.pressure_responses,
        recording_quality_score: pattern.recording_quality_score,
        is_verified: pattern.recording_quality_score > 0.8
      });

      if (error) {
        console.error('Failed to save ghost pattern:', error);
      }

    } catch (error) {
      console.error('Error saving ghost pattern:', error);
    }
  }

  // Find similar ghosts for matchmaking
  async findSimilarGhosts(playerMMR: number, skillBand: string, limit: number = 5): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('ghost_library')
        .select('*')
        .eq('skill_band', skillBand)
        .gte('recording_quality_score', 0.7)
        .order('recording_quality_score', { ascending: false })
        .limit(limit * 2); // Get more to calculate similarity

      if (error) {
        console.error('Failed to find similar ghosts:', error);
        return [];
      }

      // Calculate similarity scores
      const ghosts = data || [];
      const scoredGhosts = ghosts.map((ghost: any) => ({
        ...ghost,
        similarity_score: this.calculateSimilarity(playerMMR, ghost)
      }));

      // Sort by similarity and return top matches
      return scoredGhosts
        .sort((a: any, b: any) => b.similarity_score - a.similarity_score)
        .slice(0, limit);

    } catch (error) {
      console.error('Error finding similar ghosts:', error);
      return [];
    }
  }

  private calculateSimilarity(playerMMR: number, ghost: any): number {
    const mmrDiff = Math.abs(playerMMR - ghost.player_mmr_at_time);
    const mmrSimilarity = Math.max(0, 1 - (mmrDiff / 500)); // Normalize MMR difference

    // Combine with quality score
    return (mmrSimilarity * 0.7) + (ghost.recording_quality_score * 0.3);
  }

  // Utility methods
  private generateEventStreamHash(events: MatchEvent[]): string {
    const eventStream = JSON.stringify(events);
    return crypto.createHash('sha256').update(eventStream).digest('hex');
  }

  private generateServerSignature(hash: string): string {
    // In production, this would use a proper private key
    const secret = process.env.SERVER_SIGNATURE_SECRET || 'default-secret';
    return crypto.createHmac('sha256', secret).update(hash).digest('hex');
  }

  private generateMatchSummary(events: MatchEvent[]): any {
    const playerAEvents = events.filter(e => e.actor === 'player_a');
    const playerBEvents = events.filter(e => e.actor === 'player_b');
    
    return {
      total_events: events.length,
      player_a_actions: playerAEvents.length,
      player_b_actions: playerBEvents.length,
      match_duration: events.length > 0 ? events[events.length - 1].t_ms - events[0].t_ms : 0,
      event_types: [...new Set(events.map(e => e.event_type))]
    };
  }
}
