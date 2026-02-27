import { createClient } from '@supabase/supabase-js';

export interface TelemetryEvent {
  event_type: 'QUEUE_ENTER' | 'QUEUE_MATCH_FOUND' | 'MATCH_START' | 'MATCH_END' | 'REMATCH_OFFER_SHOWN' | 'REMATCH_ACCEPTED' | 'PLAYER_DISCONNECT' | 'RAGE_QUIT' | 'TTFM' | 'GOVERNANCE_BLOCK' | 'CIRCUIT_BREAKER_OPEN' | 'FAIRNESS_VIOLATION';
  player_id?: string;
  match_id?: string;
  event_data: any;
  timestamp?: Date;
}

export interface TelemetryMetrics {
  ttfm_p50: number;
  ttfm_p90: number;
  ttfm_p95: number;
  ttfm_p99: number;
  rematch_rate: number;
  rage_quit_rate: number;
  disconnect_rate: number;
  governance_block_rate: number;
  circuit_breaker_open_rate: number;
  fairness_violation_rate: number;
  total_matches: number;
  total_queue_enters: number;
}

export class TelemetrySystem {
  private supabase: any;
  private eventBuffer: TelemetryEvent[] = [];
  private metricsCache: Map<string, TelemetryMetrics> = new Map();
  private lastFlushTime = 0;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds
  private readonly BUFFER_SIZE = 100;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // Emit structured telemetry events
  async emitEvent(event: TelemetryEvent): Promise<void> {
    const fullEvent: TelemetryEvent = {
      ...event,
      timestamp: event.timestamp || new Date()
    };

    this.eventBuffer.push(fullEvent);

    // Flush if buffer is full or interval passed
    if (this.eventBuffer.length >= this.BUFFER_SIZE || 
        Date.now() - this.lastFlushTime > this.FLUSH_INTERVAL) {
      await this.flushEvents();
    }

    // Handle real-time alerts for critical events
    await this.handleRealTimeAlerts(fullEvent);
  }

  // Specific event emitters
  async emitQueueEnter(playerId: string, queueData: any): Promise<void> {
    await this.emitEvent({
      event_type: 'QUEUE_ENTER',
      player_id: playerId,
      event_data: {
        mode: queueData.mode,
        region: queueData.region,
        player_mmr: queueData.player_mmr,
        timestamp: Date.now()
      }
    });
  }

  async emitQueueMatchFound(playerId: string, matchData: any): Promise<void> {
    await this.emitEvent({
      event_type: 'QUEUE_MATCH_FOUND',
      player_id: playerId,
      match_id: matchData.match_id,
      event_data: {
        opponent_type: matchData.opponent_type,
        opponent_mmr: matchData.opponent_mmr,
        queue_duration_ms: matchData.queue_duration_ms,
        governance_tier: matchData.governance_tier
      }
    });
  }

  async emitMatchStart(matchId: string, matchData: any): Promise<void> {
    await this.emitEvent({
      event_type: 'MATCH_START',
      match_id: matchId,
      event_data: {
        player_a_id: matchData.player_a_id,
        player_b_id: matchData.player_b_id,
        mode: matchData.mode,
        opponent_type: matchData.opponent_type,
        governance_tier: matchData.governance_tier
      }
    });
  }

  async emitMatchEnd(matchId: string, matchResult: any): Promise<void> {
    await this.emitEvent({
      event_type: 'MATCH_END',
      match_id: matchId,
      event_data: {
        winner: matchResult.winner,
        duration_ms: matchResult.duration_ms,
        final_scores: matchResult.final_scores,
        is_close_match: matchResult.is_close_match,
        is_comeback: matchResult.is_comeback,
        rage_quit_detected: matchResult.rage_quit_detected
      }
    });
  }

  async emitRematchOfferShown(playerId: string, matchId: string, offerData: any): Promise<void> {
    await this.emitEvent({
      event_type: 'REMATCH_OFFER_SHOWN',
      player_id: playerId,
      match_id: matchId,
      event_data: {
        previous_match_result: offerData.previous_result,
        offer_delay_ms: offerData.offer_delay_ms,
        opponent_type: offerData.opponent_type
      }
    });
  }

  async emitRematchAccepted(playerId: string, matchId: string): Promise<void> {
    await this.emitEvent({
      event_type: 'REMATCH_ACCEPTED',
      player_id: playerId,
      match_id: matchId,
      event_data: {
        time_to_accept_ms: Date.now()
      }
    });
  }

  async emitPlayerDisconnect(playerId: string, matchId: string, disconnectData: any): Promise<void> {
    await this.emitEvent({
      event_type: 'PLAYER_DISCONNECT',
      player_id: playerId,
      match_id: matchId,
      event_data: {
        disconnect_time_ms: disconnectData.disconnect_time_ms,
        match_progress_pct: disconnectData.match_progress_pct,
        current_score: disconnectData.current_score,
        reason: disconnectData.reason
      }
    });
  }

  async emitRageQuit(playerId: string, matchId: string, rageQuitData: any): Promise<void> {
    await this.emitEvent({
      event_type: 'RAGE_QUIT',
      player_id: playerId,
      match_id: matchId,
      event_data: {
        quit_time_ms: rageQuitData.quit_time_ms,
        match_progress_pct: rageQuitData.match_progress_pct,
        trigger_event: rageQuitData.trigger_event,
        score_difference: rageQuitData.score_difference,
        recent_negative_swing: rageQuitData.recent_negative_swing
      }
    });
  }

  async emitTTFM(queueEnterTime: number, matchStartTime: number, playerId: string): Promise<void> {
    const ttfm = matchStartTime - queueEnterTime;
    
    await this.emitEvent({
      event_type: 'TTFM',
      player_id: playerId,
      event_data: {
        queue_enter_time: queueEnterTime,
        match_start_time: matchStartTime,
        ttfm_ms: ttfm
      }
    });
  }

  async emitGovernanceBlock(playerId: string, blockData: any): Promise<void> {
    await this.emitEvent({
      event_type: 'GOVERNANCE_BLOCK',
      player_id: playerId,
      event_data: {
        block_reason: blockData.block_reason,
        governance_tier: blockData.governance_tier,
        validation_failures: blockData.validation_failures,
        risk_scores: blockData.risk_scores,
        fallback_used: blockData.fallback_used
      }
    });
  }

  async emitCircuitBreakerOpen(circuitData: any): Promise<void> {
    await this.emitEvent({
      event_type: 'CIRCUIT_BREAKER_OPEN',
      event_data: {
        circuit_name: circuitData.circuit_name,
        failure_count: circuitData.failure_count,
        last_failure_time: circuitData.last_failure_time,
        recovery_action: circuitData.recovery_action
      }
    });
  }

  async emitFairnessViolation(violationData: any): Promise<void> {
    await this.emitEvent({
      event_type: 'FAIRNESS_VIOLATION',
      event_data: {
        violation_type: violationData.violation_type,
        threshold_exceeded: violationData.threshold_exceeded,
        current_value: violationData.current_value,
        monitoring_window: violationData.monitoring_window,
        corrective_action: violationData.corrective_action
      }
    });
  }

  // Calculate TTFM metrics
  async calculateTTFMMetrics(timeWindow: number = 3600000): Promise<{p50: number, p90: number, p95: number, p99: number}> {
    try {
      const startTime = new Date(Date.now() - timeWindow);
      
      const { data, error } = await this.supabase
        .from('telemetry_events')
        .select('event_data')
        .eq('event_type', 'TTFM')
        .gte('timestamp', startTime.toISOString());

      if (error || !data) {
        console.error('Failed to fetch TTFM data:', error);
        return { p50: 0, p90: 0, p95: 0, p99: 0 };
      }

      const ttfmValues = data.map(d => d.event_data.ttfm_ms).sort((a, b) => a - b);
      
      if (ttfmValues.length === 0) {
        return { p50: 0, p90: 0, p95: 0, p99: 0 };
      }

      return {
        p50: this.percentile(ttfmValues, 50),
        p90: this.percentile(ttfmValues, 90),
        p95: this.percentile(ttfmValues, 95),
        p99: this.percentile(ttfmValues, 99)
      };

    } catch (error) {
      console.error('Error calculating TTFM metrics:', error);
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }
  }

  // Calculate rematch rate
  async calculateRematchRate(timeWindow: number = 3600000): Promise<number> {
    try {
      const startTime = new Date(Date.now() - timeWindow);
      
      const [offersResult, acceptsResult] = await Promise.all([
        this.supabase
          .from('telemetry_events')
          .select('player_id')
          .eq('event_type', 'REMATCH_OFFER_SHOWN')
          .gte('timestamp', startTime.toISOString()),
        
        this.supabase
          .from('telemetry_events')
          .select('player_id')
          .eq('event_type', 'REMATCH_ACCEPTED')
          .gte('timestamp', startTime.toISOString())
      ]);

      if (offersResult.error || acceptsResult.error) {
        console.error('Failed to fetch rematch data:', offersResult.error || acceptsResult.error);
        return 0;
      }

      const offersCount = offersResult.data?.length || 0;
      const acceptsCount = acceptsResult.data?.length || 0;

      return offersCount > 0 ? acceptsCount / offersCount : 0;

    } catch (error) {
      console.error('Error calculating rematch rate:', error);
      return 0;
    }
  }

  // Calculate rage quit rate
  async calculateRageQuitRate(timeWindow: number = 3600000): Promise<number> {
    try {
      const startTime = new Date(Date.now() - timeWindow);
      
      const [matchesResult, rageQuitsResult] = await Promise.all([
        this.supabase
          .from('telemetry_events')
          .select('match_id')
          .eq('event_type', 'MATCH_END')
          .gte('timestamp', startTime.toISOString()),
        
        this.supabase
          .from('telemetry_events')
          .select('match_id')
          .eq('event_type', 'RAGE_QUIT')
          .gte('timestamp', startTime.toISOString())
      ]);

      if (matchesResult.error || rageQuitsResult.error) {
        console.error('Failed to fetch rage quit data:', matchesResult.error || rageQuitsResult.error);
        return 0;
      }

      const matchesCount = matchesResult.data?.length || 0;
      const rageQuitsCount = rageQuitsResult.data?.length || 0;

      return matchesCount > 0 ? rageQuitsCount / matchesCount : 0;

    } catch (error) {
      console.error('Error calculating rage quit rate:', error);
      return 0;
    }
  }

  // Get comprehensive metrics dashboard
  async getMetricsDashboard(timeWindow: number = 3600000): Promise<TelemetryMetrics> {
    const cacheKey = `metrics_${timeWindow}`;
    
    // Check cache first
    if (this.metricsCache.has(cacheKey)) {
      const cached = this.metricsCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < 30000) { // 30 second cache
        return cached;
      }
    }

    try {
      const [ttfmMetrics, rematchRate, rageQuitRate, disconnectRate, governanceBlockRate, circuitBreakerRate, fairnessViolationRate, totalMatches, totalQueueEnters] = await Promise.all([
        this.calculateTTFMMetrics(timeWindow),
        this.calculateRematchRate(timeWindow),
        this.calculateRageQuitRate(timeWindow),
        this.calculateDisconnectRate(timeWindow),
        this.calculateGovernanceBlockRate(timeWindow),
        this.calculateCircuitBreakerRate(timeWindow),
        this.calculateFairnessViolationRate(timeWindow),
        this.getTotalMatches(timeWindow),
        this.getTotalQueueEnters(timeWindow)
      ]);

      const metrics: TelemetryMetrics = {
        ttfm_p50: ttfmMetrics.p50,
        ttfm_p90: ttfmMetrics.p90,
        ttfm_p95: ttfmMetrics.p95,
        ttfm_p99: ttfmMetrics.p99,
        rematch_rate: rematchRate,
        rage_quit_rate: rageQuitRate,
        disconnect_rate: disconnectRate,
        governance_block_rate: governanceBlockRate,
        circuit_breaker_open_rate: circuitBreakerRate,
        fairness_violation_rate: fairnessViolationRate,
        total_matches: totalMatches,
        total_queue_enters: totalQueueEnters,
        timestamp: Date.now()
      } as any;

      // Cache the results
      this.metricsCache.set(cacheKey, metrics);

      return metrics;

    } catch (error) {
      console.error('Error getting metrics dashboard:', error);
      return this.getDefaultMetrics();
    }
  }

  // Helper methods for rate calculations
  private async calculateDisconnectRate(timeWindow: number): Promise<number> {
    const startTime = new Date(Date.now() - timeWindow);
    
    const [matchesResult, disconnectsResult] = await Promise.all([
      this.supabase
        .from('telemetry_events')
        .select('match_id')
        .eq('event_type', 'MATCH_START')
        .gte('timestamp', startTime.toISOString()),
      
      this.supabase
        .from('telemetry_events')
        .select('match_id')
        .eq('event_type', 'PLAYER_DISCONNECT')
        .gte('timestamp', startTime.toISOString())
    ]);

    const matchesCount = matchesResult.data?.length || 0;
    const disconnectsCount = disconnectsResult.data?.length || 0;

    return matchesCount > 0 ? disconnectsCount / matchesCount : 0;
  }

  private async calculateGovernanceBlockRate(timeWindow: number): Promise<number> {
    const startTime = new Date(Date.now() - timeWindow);
    
    const [totalPlansResult, blocksResult] = await Promise.all([
      this.supabase
        .from('match_opponent_plans')
        .select('id')
        .gte('created_at', startTime.toISOString()),
      
      this.supabase
        .from('telemetry_events')
        .select('id')
        .eq('event_type', 'GOVERNANCE_BLOCK')
        .gte('timestamp', startTime.toISOString())
    ]);

    const totalPlans = totalPlansResult.data?.length || 0;
    const blocks = blocksResult.data?.length || 0;

    return totalPlans > 0 ? blocks / totalPlans : 0;
  }

  private async calculateCircuitBreakerRate(timeWindow: number): Promise<number> {
    const startTime = new Date(Date.now() - timeWindow);
    
    const { data, error } = await this.supabase
      .from('telemetry_events')
      .select('id')
      .eq('event_type', 'CIRCUIT_BREAKER_OPEN')
      .gte('timestamp', startTime.toISOString());

    return (data?.length || 0) / (timeWindow / 3600000); // Per hour
  }

  private async calculateFairnessViolationRate(timeWindow: number): Promise<number> {
    const startTime = new Date(Date.now() - timeWindow);
    
    const { data, error } = await this.supabase
      .from('telemetry_events')
      .select('id')
      .eq('event_type', 'FAIRNESS_VIOLATION')
      .gte('timestamp', startTime.toISOString());

    return (data?.length || 0) / (timeWindow / 3600000); // Per hour
  }

  private async getTotalMatches(timeWindow: number): Promise<number> {
    const startTime = new Date(Date.now() - timeWindow);
    
    const { data, error } = await this.supabase
      .from('telemetry_events')
      .select('id')
      .eq('event_type', 'MATCH_END')
      .gte('timestamp', startTime.toISOString());

    return data?.length || 0;
  }

  private async getTotalQueueEnters(timeWindow: number): Promise<number> {
    const startTime = new Date(Date.now() - timeWindow);
    
    const { data, error } = await this.supabase
      .from('telemetry_events')
      .select('id')
      .eq('event_type', 'QUEUE_ENTER')
      .gte('timestamp', startTime.toISOString());

    return data?.length || 0;
  }

  // Real-time alert handling
  private async handleRealTimeAlerts(event: TelemetryEvent): Promise<void> {
    switch (event.event_type) {
      case 'RAGE_QUIT':
        await this.handleRageQuitAlert(event);
        break;
      case 'GOVERNANCE_BLOCK':
        await this.handleGovernanceBlockAlert(event);
        break;
      case 'CIRCUIT_BREAKER_OPEN':
        await this.handleCircuitBreakerAlert(event);
        break;
      case 'FAIRNESS_VIOLATION':
        await this.handleFairnessViolationAlert(event);
        break;
    }
  }

  private async handleRageQuitAlert(event: TelemetryEvent): Promise<void> {
    const rageQuitData = event.event_data;
    
    // Check for rage quit spike
    const recentRageQuits = await this.getRecentEventCount('RAGE_QUIT', 300000); // 5 minutes
    const recentMatches = await this.getRecentEventCount('MATCH_END', 300000);
    
    if (recentMatches > 0 && recentRageQuits / recentMatches > 0.1) { // >10% rage quit rate
      console.warn('🚨 RAGE QUIT SPIKE DETECTED:', {
        rage_quits: recentRageQuits,
        matches: recentMatches,
        rate: recentRageQuits / recentMatches
      });
      
      // Trigger governance review
      await this.emitFairnessViolation({
        violation_type: 'rage_quit_spike',
        threshold_exceeded: 0.1,
        current_value: recentRageQuits / recentMatches,
        monitoring_window: '5_minutes',
        corrective_action: 'governance_review_required'
      });
    }
  }

  private async handleGovernanceBlockAlert(event: TelemetryEvent): Promise<void> {
    const blockData = event.event_data;
    
    // Check for governance block spike
    const recentBlocks = await this.getRecentEventCount('GOVERNANCE_BLOCK', 300000);
    
    if (recentBlocks > 5) { // More than 5 blocks in 5 minutes
      console.warn('🚨 GOVERNANCE BLOCK SPIKE DETECTED:', {
        blocks: recentBlocks,
        time_window: '5_minutes'
      });
    }
  }

  private async handleCircuitBreakerAlert(event: TelemetryEvent): Promise<void> {
    const circuitData = event.event_data;
    
    console.error('🚨 CIRCUIT BREAKER OPENED:', circuitData);
    
    // Admin alert would go here in production
    // await this.sendAdminAlert('CIRCUIT_BREAKER_OPEN', circuitData);
  }

  private async handleFairnessViolationAlert(event: TelemetryEvent): Promise<void> {
    const violationData = event.event_data;
    
    console.warn('🚨 FAIRNESS VIOLATION:', violationData);
    
    // Admin alert would go here in production
    // await this.sendAdminAlert('FAIRNESS_VIOLATION', violationData);
  }

  private async getRecentEventCount(eventType: string, timeWindow: number): Promise<number> {
    const startTime = new Date(Date.now() - timeWindow);
    
    const { data, error } = await this.supabase
      .from('telemetry_events')
      .select('id')
      .eq('event_type', eventType)
      .gte('timestamp', startTime.toISOString());

    return data?.length || 0;
  }

  // Utility methods
  private percentile(values: number[], p: number): number {
    const index = (p / 100) * (values.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return values[lower];
    }
    
    const weight = index - lower;
    return values[lower] * (1 - weight) + values[upper] * weight;
  }

  private getDefaultMetrics(): TelemetryMetrics {
    return {
      ttfm_p50: 0,
      ttfm_p90: 0,
      ttfm_p95: 0,
      ttfm_p99: 0,
      rematch_rate: 0,
      rage_quit_rate: 0,
      disconnect_rate: 0,
      governance_block_rate: 0,
      circuit_breaker_open_rate: 0,
      fairness_violation_rate: 0,
      total_matches: 0,
      total_queue_enters: 0,
      timestamp: Date.now()
    } as any;
  }

  // Flush events to database
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      const { error } = await this.supabase.from('telemetry_events').insert(
        events.map(event => ({
          event_type: event.event_type,
          player_id: event.player_id,
          match_id: event.match_id,
          event_data: event.event_data,
          timestamp: event.timestamp?.toISOString()
        }))
      );

      if (error) {
        console.error('Failed to flush telemetry events:', error);
        // Re-add events to buffer for retry
        this.eventBuffer.unshift(...events);
      } else {
        this.lastFlushTime = Date.now();
      }

    } catch (error) {
      console.error('Error flushing telemetry events:', error);
    }
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    await this.flushEvents();
    this.metricsCache.clear();
  }
}
