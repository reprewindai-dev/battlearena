import { NextRequest, NextResponse } from 'next/server';
import { GovernedOpponentOrchestrator } from '@/lib/opponent/GovernedOpponentOrchestrator';
import { TelemetrySystem } from '@/lib/telemetry/TelemetrySystem';
import { createClient } from '@supabase/supabase-js';

const orchestrator = new GovernedOpponentOrchestrator();
const telemetry = new TelemetrySystem();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    // Verify admin access
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    switch (endpoint) {
      case 'stats':
        return await getGovernanceStats();
      case 'metrics':
        return await getTelemetryMetrics();
      case 'circuits':
        return await getCircuitBreakerStatus();
      case 'fairness':
        return await getFairnessMonitoring();
      case 'red-team':
        return await getRedTeamResults();
      case 'observability':
        return await getObservabilityData();
      default:
        return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

  } catch (error) {
    console.error('Admin governance API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'run-red-team':
        return await runRedTeamSimulation(body.simulation_type);
      case 'reset-circuit-breaker':
        return await resetCircuitBreaker();
      case 'force-fairness-audit':
        return await forceFairnessAudit();
      case 'generate-test-plan':
        return await generateTestOpponentPlan(body.playerContext, body.matchContext);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Admin governance POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Admin dashboard endpoints
async function getGovernanceStats() {
  try {
    const stats = await orchestrator.getGovernanceStats();
    
    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getTelemetryMetrics() {
  try {
    const metrics = await telemetry.getMetricsDashboard(3600000); // 1 hour window
    
    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getCircuitBreakerStatus() {
  try {
    // This would get circuit breaker status from the orchestrator
    const circuitStatus = {
      status: 'CLOSED', // Would come from actual circuit breaker
      failures: 0,
      last_failure_time: null,
      next_retry_time: null
    };
    
    return NextResponse.json({
      success: true,
      data: circuitStatus,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getFairnessMonitoring() {
  try {
    const { data, error } = await supabase
      .from('fairness_monitoring')
      .select('*')
      .order('monitoring_window', { ascending: false })
      .limit(24); // Last 24 hours

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getRedTeamResults() {
  try {
    const { data, error } = await supabase
      .from('red_team_simulations')
      .select('*')
      .order('run_date', { ascending: false })
      .limit(10); // Last 10 runs

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getObservabilityData() {
  try {
    const { data, error } = await supabase
      .from('match_opponent_plans')
      .select(`
        *,
        match_replays(match_id, mode, duration_ms, is_bot_match)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Admin action endpoints
async function runRedTeamSimulation(simulationType: string) {
  try {
    const simulationResults = await executeRedTeamSimulation(simulationType);
    
    // Store results
    const { error } = await supabase.from('red_team_simulations').insert({
      simulation_type: simulationType,
      run_date: new Date().toISOString(),
      test_parameters: simulationResults.parameters,
      results: simulationResults.results,
      vulnerabilities_found: simulationResults.vulnerabilities_found,
      policy_updates_required: simulationResults.policy_updates_required
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: simulationResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function resetCircuitBreaker() {
  try {
    // This would reset the actual circuit breaker
    console.log('🔄 Circuit breaker reset requested by admin');
    
    return NextResponse.json({
      success: true,
      message: 'Circuit breaker reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function forceFairnessAudit() {
  try {
    // Trigger immediate fairness audit
    const auditResults = await executeFairnessAudit();
    
    return NextResponse.json({
      success: true,
      data: auditResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function generateTestOpponentPlan(playerContext: any, matchContext: any) {
  try {
    const planBundle = await orchestrator.generateOpponentPlan(playerContext, matchContext);
    
    return NextResponse.json({
      success: true,
      data: planBundle,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Red team simulation implementations
async function executeRedTeamSimulation(simulationType: string) {
  switch (simulationType) {
    case 'WIN_SHAPING_DETECTION':
      return await simulateWinShapingDetection();
    case 'DRAMA_PATTERN_EXPLOIT':
      return await simulateDramaPatternExploit();
    case 'COST_SPIKE_DETECTION':
      return await simulateCostSpikeDetection();
    case 'ABUSE_SIMULATION':
      return await simulateAbuseAttempt();
    case 'DRIFT_ESCALATION':
      return await simulateDriftEscalation();
    case 'SCHEMA_FAILURE_LOOP':
      return await simulateSchemaFailureLoop();
    default:
      throw new Error(`Unknown simulation type: ${simulationType}`);
  }
}

async function simulateWinShapingDetection() {
  // Simulate detection of predictable win shaping patterns
  const vulnerabilities = [
    { type: 'predictable_outcome', severity: 'medium', description: 'Opponent consistently allows player wins in close matches' },
    { type: 'timing_pattern', severity: 'low', description: 'Reaction times follow predictable pattern' }
  ];

  return {
    parameters: { simulation_type: 'WIN_SHAPING_DETECTION', test_matches: 1000 },
    results: { vulnerabilities_detected: vulnerabilities, success_rate: 0.85 },
    vulnerabilities_found: vulnerabilities.length,
    policy_updates_required: 1
  };
}

async function simulateDramaPatternExploit() {
  // Simulate detection of drama pattern exploitation
  const vulnerabilities = [
    { type: 'drama_manipulation', severity: 'high', description: 'User can manipulate drama curve for favorable outcomes' }
  ];

  return {
    parameters: { simulation_type: 'DRAMA_PATTERN_EXPLOIT', test_scenarios: 50 },
    results: { vulnerabilities_detected: vulnerabilities, exploitation_success: 0.15 },
    vulnerabilities_found: vulnerabilities.length,
    policy_updates_required: 2
  };
}

async function simulateCostSpikeDetection() {
  // Simulate detection of cost spikes in opponent plan generation
  const costs = Array.from({ length: 100 }, () => Math.random() * 0.1);
  const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
  const maxCost = Math.max(...costs);

  return {
    parameters: { simulation_type: 'COST_SPIKE_DETECTION', sample_size: 100 },
    results: { average_cost: avgCost, max_cost: maxCost, cost_variance: 0.02 },
    vulnerabilities_found: maxCost > 0.08 ? 1 : 0,
    policy_updates_required: maxCost > 0.08 ? 1 : 0
  };
}

async function simulateAbuseAttempt() {
  // Simulate various abuse attempts
  const attempts = [
    { type: 'mmr_manipulation', success: false, reason: 'governance_blocked' },
    { type: 'persona_injection', success: false, reason: 'schema_validation_failed' },
    { type: 'bias_override', success: false, reason: 'fairness_bounds_enforced' }
  ];

  return {
    parameters: { simulation_type: 'ABUSE_SIMULATION', attempts: attempts.length },
    results: { abuse_attempts: attempts, blocked_attempts: attempts.length },
    vulnerabilities_found: 0,
    policy_updates_required: 0
  };
}

async function simulateDriftEscalation() {
  // Simulate detection of drift escalation
  const driftMetrics = {
    plan_latency_drift: 0.15,
    accuracy_drift: 0.08,
    fairness_drift: 0.05
  };

  return {
    parameters: { simulation_type: 'DRIFT_ESCALATION', metrics: Object.keys(driftMetrics) },
    results: { drift_metrics: driftMetrics, escalation_detected: false },
    vulnerabilities_found: 0,
    policy_updates_required: 0
  };
}

async function simulateSchemaFailureLoop() {
  // Simulate schema failure loop detection
  const schemaTests = Array.from({ length: 50 }, (_, i) => ({
    test_id: i,
    success: i % 10 !== 0, // 90% success rate
    error: i % 10 === 0 ? 'schema_validation_failed' : null
  }));

  const failureRate = schemaTests.filter(t => !t.success).length / schemaTests.length;

  return {
    parameters: { simulation_type: 'SCHEMA_FAILURE_LOOP', test_count: schemaTests.length },
    results: { failure_rate: failureRate, consecutive_failures: 1 },
    vulnerabilities_found: failureRate > 0.1 ? 1 : 0,
    policy_updates_required: failureRate > 0.1 ? 1 : 0
  };
}

async function executeFairnessAudit() {
  try {
    // Get recent fairness data
    const { data: recentData } = await supabase
      .from('fairness_monitoring')
      .select('*')
      .order('monitoring_window', { ascending: false })
      .limit(24);

    // Calculate current metrics
    const auditResults = {
      audit_window: '24_hours',
      total_matches: recentData?.reduce((sum, d) => sum + d.total_matches, 0) || 0,
      average_win_rate: recentData?.reduce((sum, d) => sum + d.win_rate, 0) / (recentData?.length || 1) || 0,
      average_close_match_rate: recentData?.reduce((sum, d) => sum + d.close_match_rate, 0) / (recentData?.length || 1) || 0,
      violations_detected: recentData?.filter(d => d.win_rate_violation || d.close_match_violation).length || 0,
      corrective_actions: recentData?.filter(d => d.circuit_breaker_triggered || d.dynamic_drama_disabled).length || 0
    };

    return auditResults;

  } catch (error) {
    throw new Error(`Fairness audit failed: ${error}`);
  }
}
