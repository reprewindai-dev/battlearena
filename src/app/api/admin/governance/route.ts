import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import {
  GovernedOpponentOrchestrator,
  type MatchContext,
  type PlayerContext,
} from "@/lib/opponent/GovernedOpponentOrchestrator";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const orchestrator = new GovernedOpponentOrchestrator();

const endpointSchema = z.enum([
  "stats",
  "metrics",
  "circuits",
  "fairness",
  "red-team",
  "observability",
]);

const actionSchema = z.enum([
  "run-red-team",
  "reset-circuit-breaker",
  "force-fairness-audit",
  "generate-test-plan",
]);

const simulationTypeSchema = z.enum([
  "WIN_SHAPING_DETECTION",
  "DRAMA_PATTERN_EXPLOIT",
  "COST_SPIKE_DETECTION",
  "ABUSE_SIMULATION",
  "DRIFT_ESCALATION",
  "SCHEMA_FAILURE_LOOP",
]);

type GovernancePlanRow = {
  governance_tier: string | null;
  persona: string | null;
  drama_archetype: string | null;
  latency_ms: number | null;
  cost_per_plan: number | null;
};

type CircuitStateRow = {
  state: string | null;
  failures: number | null;
  last_failure_time: string | null;
  updated_at: string | null;
};

type TelemetryEventRow = {
  event_type: string;
  event_data: Record<string, unknown> | null;
  match_id: string | null;
  timestamp: string;
};

async function requireAdmin() {
  const role = await getSessionRole();
  return role === "admin";
}

function percentile(sortedAsc: number[], pct: number) {
  if (!sortedAsc.length) return 0;
  const index = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((pct / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[index] ?? 0;
}

function countBy<T extends string>(values: T[], allowed: readonly T[]) {
  const counts = Object.fromEntries(allowed.map((value) => [value, 0])) as Record<
    T,
    number
  >;
  for (const value of values) {
    if (value in counts) counts[value] += 1;
  }
  return counts;
}

async function getGovernanceStats() {
  const supabase = createSupabaseServiceRoleClient();

  const [plansRes, circuitRes] = await Promise.all([
    supabase
      .from("match_opponent_plans")
      .select("governance_tier,persona,drama_archetype,latency_ms,cost_per_plan")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("governance_circuit_breaker_state")
      .select("state,failures,last_failure_time,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (plansRes.error) throw plansRes.error;
  if (circuitRes.error) throw circuitRes.error;

  const plans = (plansRes.data ?? []) as GovernancePlanRow[];
  const latencies = plans.map((row) => row.latency_ms ?? 0);
  const costs = plans.map((row) => Number(row.cost_per_plan ?? 0));
  const totalPlans = plans.length;

  return {
    total_plans: totalPlans,
    tier_distribution: countBy(
      plans.map((row) => row.governance_tier ?? "BLOCKED"),
      ["TIER1", "TIER2", "FALLBACK", "BLOCKED"] as const,
    ),
    persona_distribution: countBy(
      plans.map((row) => row.persona ?? "Aggro"),
      ["Aggro", "Turtle", "Counter", "Gambler"] as const,
    ),
    drama_distribution: countBy(
      plans.map((row) => row.drama_archetype ?? "control_win"),
      ["close_win", "close_loss", "comeback", "control_win", "stomp_rare"] as const,
    ),
    average_latency:
      totalPlans > 0
        ? Math.round(latencies.reduce((acc, current) => acc + current, 0) / totalPlans)
        : 0,
    average_cost:
      totalPlans > 0 ? costs.reduce((acc, current) => acc + current, 0) / totalPlans : 0,
    circuit_breaker_status: {
      state: circuitRes.data?.state ?? "CLOSED",
      failures: circuitRes.data?.failures ?? 0,
      lastFailureTime: circuitRes.data?.last_failure_time ?? null,
      updatedAt: circuitRes.data?.updated_at ?? null,
    },
  };
}

async function getTelemetryMetrics() {
  const supabase = createSupabaseServiceRoleClient();
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("telemetry_events")
    .select("event_type,event_data,match_id,timestamp")
    .gte("timestamp", sinceIso);

  if (error) throw error;

  const events = (data ?? []) as TelemetryEventRow[];
  const ttfm = events
    .filter((event) => event.event_type === "TTFM")
    .map((event) => Number(event.event_data?.ttfm_ms ?? 0))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);

  const rematchOffers = events.filter((event) => event.event_type === "REMATCH_OFFER_SHOWN").length;
  const rematchAccepted = events.filter((event) => event.event_type === "REMATCH_ACCEPTED").length;
  const matchEnd = events.filter((event) => event.event_type === "MATCH_END").length;
  const matchStart = events.filter((event) => event.event_type === "MATCH_START").length;
  const rageQuit = events.filter((event) => event.event_type === "RAGE_QUIT").length;
  const disconnects = events.filter((event) => event.event_type === "PLAYER_DISCONNECT").length;
  const queueEnters = events.filter((event) => event.event_type === "QUEUE_ENTER").length;
  const governanceBlocks = events.filter((event) => event.event_type === "GOVERNANCE_BLOCK").length;
  const circuitOpens = events.filter((event) => event.event_type === "CIRCUIT_BREAKER_OPEN").length;
  const fairnessViolations = events.filter((event) => event.event_type === "FAIRNESS_VIOLATION").length;

  return {
    ttfm_p50: percentile(ttfm, 50),
    ttfm_p90: percentile(ttfm, 90),
    ttfm_p95: percentile(ttfm, 95),
    ttfm_p99: percentile(ttfm, 99),
    rematch_rate: rematchOffers > 0 ? rematchAccepted / rematchOffers : 0,
    rage_quit_rate: matchEnd > 0 ? rageQuit / matchEnd : 0,
    disconnect_rate: matchStart > 0 ? disconnects / matchStart : 0,
    governance_block_rate: queueEnters > 0 ? governanceBlocks / queueEnters : 0,
    circuit_breaker_open_rate: circuitOpens,
    fairness_violation_rate: fairnessViolations,
    total_matches: matchEnd,
    total_queue_enters: queueEnters,
  };
}

async function getCircuitBreakerStatus() {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("governance_circuit_breaker_state")
    .select("state,failures,last_failure_time,updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const row = data as CircuitStateRow | null;
  return {
    state: row?.state ?? "CLOSED",
    failures: row?.failures ?? 0,
    last_failure_time: row?.last_failure_time ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

async function getFairnessMonitoring() {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("fairness_monitoring")
    .select("*")
    .order("monitoring_window", { ascending: false })
    .limit(24);

  if (error) throw error;
  return data ?? [];
}

async function getRedTeamResults() {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("red_team_simulations")
    .select("*")
    .order("run_date", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

async function getObservabilityData() {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("match_opponent_plans")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

async function runRedTeamSimulation(simulationType: z.infer<typeof simulationTypeSchema>) {
  const supabase = createSupabaseServiceRoleClient();

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [plansRes, fairnessRes, moderationRes, telemetryRes] = await Promise.all([
    supabase
      .from("match_opponent_plans")
      .select("created_at,persona,drama_archetype,cost_per_plan,latency_ms")
      .gte("created_at", since24h)
      .limit(2000),
    supabase
      .from("fairness_monitoring")
      .select("*")
      .gte("monitoring_window", since24h)
      .limit(2000),
    supabase
      .from("moderation_cases")
      .select("status,created_at")
      .gte("created_at", since24h)
      .limit(2000),
    supabase
      .from("telemetry_events")
      .select("event_type,event_data,timestamp")
      .gte("timestamp", since24h)
      .limit(5000),
  ]);

  if (plansRes.error) throw plansRes.error;
  if (fairnessRes.error) throw fairnessRes.error;
  if (moderationRes.error) throw moderationRes.error;
  if (telemetryRes.error) throw telemetryRes.error;

  const plans = plansRes.data ?? [];
  const fairnessRows = fairnessRes.data ?? [];
  const moderationRows = moderationRes.data ?? [];
  const telemetryRows = telemetryRes.data ?? [];

  let results: Record<string, unknown> = {};
  let vulnerabilitiesFound = 0;
  let policyUpdatesRequired = 0;

  if (simulationType === "WIN_SHAPING_DETECTION") {
    const suspectWindows = fairnessRows.filter((row) => {
      const winRate = Number(row.win_rate ?? 0.5);
      const closeRate = Number(row.close_match_rate ?? 0);
      return Math.abs(winRate - 0.5) > 0.07 || closeRate > 0.65;
    });
    vulnerabilitiesFound = suspectWindows.length;
    policyUpdatesRequired = suspectWindows.length > 0 ? 1 : 0;
    results = {
      suspect_windows: suspectWindows.length,
      total_windows: fairnessRows.length,
      threshold: { max_win_rate_drift: 0.07, max_close_match_rate: 0.65 },
    };
  } else if (simulationType === "DRAMA_PATTERN_EXPLOIT") {
    const distribution = countBy(
      plans.map((row) => String(row.drama_archetype ?? "control_win")),
      ["close_win", "close_loss", "comeback", "control_win", "stomp_rare"] as const,
    );
    const maxShare =
      plans.length > 0 ? Math.max(...Object.values(distribution).map((count) => count / plans.length)) : 0;
    vulnerabilitiesFound = maxShare > 0.6 ? 1 : 0;
    policyUpdatesRequired = vulnerabilitiesFound;
    results = {
      drama_distribution: distribution,
      max_archetype_share: maxShare,
      threshold: 0.6,
    };
  } else if (simulationType === "COST_SPIKE_DETECTION") {
    const costs = plans
      .map((row) => Number(row.cost_per_plan ?? 0))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((a, b) => a - b);
    const p95 = percentile(costs, 95);
    const max = costs[costs.length - 1] ?? 0;
    vulnerabilitiesFound = p95 > 0.08 || max > 0.12 ? 1 : 0;
    policyUpdatesRequired = vulnerabilitiesFound;
    results = {
      sample_size: costs.length,
      p95_cost: p95,
      max_cost: max,
      thresholds: { p95: 0.08, max: 0.12 },
    };
  } else if (simulationType === "ABUSE_SIMULATION") {
    const escalatedCases = moderationRows.filter((row) => row.status === "escalated").length;
    const openCases = moderationRows.filter((row) => row.status === "open").length;
    vulnerabilitiesFound = escalatedCases > 0 ? 1 : 0;
    policyUpdatesRequired = escalatedCases > 0 || openCases > 25 ? 1 : 0;
    results = {
      open_cases_24h: openCases,
      escalated_cases_24h: escalatedCases,
      threshold: { open_cases: 25, escalated_cases: 0 },
    };
  } else if (simulationType === "DRIFT_ESCALATION") {
    const latencyValues = plans
      .map((row) => Number(row.latency_ms ?? 0))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const avgLatency =
      latencyValues.length > 0
        ? latencyValues.reduce((acc, value) => acc + value, 0) / latencyValues.length
        : 0;
    vulnerabilitiesFound = avgLatency > 300 ? 1 : 0;
    policyUpdatesRequired = vulnerabilitiesFound;
    results = {
      sample_size: latencyValues.length,
      average_latency_ms: avgLatency,
      threshold_ms: 300,
    };
  } else {
    const recentBlocks = telemetryRows.filter((row) => row.event_type === "GOVERNANCE_BLOCK").length;
    const recentPlans = plans.length;
    const blockRate = recentPlans > 0 ? recentBlocks / recentPlans : 0;
    vulnerabilitiesFound = blockRate > 0.2 ? 1 : 0;
    policyUpdatesRequired = vulnerabilitiesFound;
    results = {
      governance_blocks_24h: recentBlocks,
      plans_24h: recentPlans,
      block_rate: blockRate,
      threshold: 0.2,
    };
  }

  const simulationRecord = {
    simulation_type: simulationType,
    run_date: now.toISOString(),
    test_parameters: { window_hours: 24 },
    results,
    vulnerabilities_found: vulnerabilitiesFound,
    policy_updates_required: policyUpdatesRequired,
  };

  const { error: insertError } = await supabase
    .from("red_team_simulations")
    .insert(simulationRecord);
  if (insertError) throw insertError;

  return simulationRecord;
}

async function resetCircuitBreaker() {
  const supabase = createSupabaseServiceRoleClient();

  const upsertPayload = {
    id: "global",
    state: "CLOSED",
    failures: 0,
    last_failure_time: null,
    reset_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("governance_circuit_breaker_state")
    .upsert(upsertPayload, { onConflict: "id" });
  if (error) throw error;

  return upsertPayload;
}

async function forceFairnessAudit() {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("fairness_monitoring")
    .select("*")
    .order("monitoring_window", { ascending: false })
    .limit(24);

  if (error) throw error;

  const rows = data ?? [];
  const totals = rows.reduce(
    (acc, row) => {
      acc.totalMatches += Number(row.total_matches ?? 0);
      acc.totalWinRate += Number(row.win_rate ?? 0);
      acc.totalCloseRate += Number(row.close_match_rate ?? 0);
      acc.violations += row.win_rate_violation || row.close_match_violation ? 1 : 0;
      acc.correctiveActions += row.circuit_breaker_triggered || row.dynamic_drama_disabled ? 1 : 0;
      return acc;
    },
    {
      totalMatches: 0,
      totalWinRate: 0,
      totalCloseRate: 0,
      violations: 0,
      correctiveActions: 0,
    },
  );

  return {
    audit_window: "24_hours",
    sample_points: rows.length,
    total_matches: totals.totalMatches,
    average_win_rate: rows.length > 0 ? totals.totalWinRate / rows.length : 0,
    average_close_match_rate: rows.length > 0 ? totals.totalCloseRate / rows.length : 0,
    violations_detected: totals.violations,
    corrective_actions: totals.correctiveActions,
  };
}

const generatePlanSchema = z.object({
  playerContext: z.object({
    id: z.string().uuid(),
    mmr: z.number().int().nonnegative(),
    region: z.string().min(2).max(16),
    skill_level: z.string().min(2).max(32),
    recent_matches: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
  matchContext: z.object({
    mode: z.enum(["ranked", "casual"]),
    queue_time: z.number().int().nonnegative(),
    expected_duration: z.number().int().positive(),
  }),
});

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsedEndpoint = endpointSchema.safeParse(searchParams.get("endpoint"));
    if (!parsedEndpoint.success) {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    }

    const endpoint = parsedEndpoint.data;
    const data =
      endpoint === "stats"
        ? await getGovernanceStats()
        : endpoint === "metrics"
          ? await getTelemetryMetrics()
          : endpoint === "circuits"
            ? await getCircuitBreakerStatus()
            : endpoint === "fairness"
              ? await getFairnessMonitoring()
              : endpoint === "red-team"
                ? await getRedTeamResults()
                : await getObservabilityData();

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Admin governance GET error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const actor = await getSessionUser();
  if (!(await requireAdmin()) || !actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsedAction = actionSchema.safeParse(body.action);
    if (!parsedAction.success) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const action = parsedAction.data;
    let data: unknown;
    if (action === "run-red-team") {
      data = await runRedTeamSimulation(simulationTypeSchema.parse(body.simulation_type));
    } else if (action === "reset-circuit-breaker") {
      data = await resetCircuitBreaker();
    } else if (action === "force-fairness-audit") {
      data = await forceFairnessAudit();
    } else {
      const parsed = generatePlanSchema.parse(body);
      data = await orchestrator.generateOpponentPlan(
        parsed.playerContext as PlayerContext,
        parsed.matchContext as MatchContext,
      );
    }

    await createSupabaseServiceRoleClient().from("admin_audit_log").insert({
      actor_user_id: actor.id,
      action: "admin_governance_action",
      payload: {
        action,
        simulation_type: body.simulation_type ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Admin governance POST error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
