import { NextRequest, NextResponse } from "next/server";

import { getSessionRole } from "@/lib/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { TelemetrySystem } from "@/lib/telemetry/TelemetrySystem";

async function countTelemetryEvents(adminClient: ReturnType<typeof createSupabaseServiceRoleClient>, eventType: string, sinceIso: string) {
  const { count } = await adminClient
    .from("telemetry_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", eventType)
    .gte("timestamp", sinceIso);

  return count ?? 0;
}

async function countPaymentLedger(adminClient: ReturnType<typeof createSupabaseServiceRoleClient>, status: string, sinceIso: string) {
  const { count } = await adminClient
    .from("payment_ledger")
    .select("id", { count: "exact", head: true })
    .eq("status", status)
    .gte("updated_at", sinceIso);

  return count ?? 0;
}

export async function GET(request: NextRequest) {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const hoursRaw = Number(new URL(request.url).searchParams.get("hours") ?? 24);
  const hours = Number.isFinite(hoursRaw) ? Math.max(1, Math.min(168, Math.floor(hoursRaw))) : 24;
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const adminClient = createSupabaseServiceRoleClient();
  const telemetry = new TelemetrySystem();
  const metrics = await telemetry.getMetricsDashboard(hours * 60 * 60 * 1000);

  const [
    signupStarted,
    signupCompleted,
    signupFailed,
    loginCompleted,
    loginFailed,
    profileCompleted,
    queueJoined,
    battleStarted,
    battleCompleted,
    tournamentRegistered,
    checkoutStarted,
    purchaseCompleted,
    purchaseFailed,
    livekitIssued,
    livekitFailed,
    revenueSucceeded,
    revenueFailed,
  ] = await Promise.all([
    countTelemetryEvents(adminClient, "SIGNUP_STARTED", sinceIso),
    countTelemetryEvents(adminClient, "SIGNUP_COMPLETED", sinceIso),
    countTelemetryEvents(adminClient, "SIGNUP_FAILED", sinceIso),
    countTelemetryEvents(adminClient, "LOGIN_COMPLETED", sinceIso),
    countTelemetryEvents(adminClient, "LOGIN_FAILED", sinceIso),
    countTelemetryEvents(adminClient, "PROFILE_COMPLETED", sinceIso),
    countTelemetryEvents(adminClient, "QUEUE_ENTER", sinceIso),
    countTelemetryEvents(adminClient, "MATCH_START", sinceIso),
    countTelemetryEvents(adminClient, "MATCH_END", sinceIso),
    countTelemetryEvents(adminClient, "TOURNAMENT_REGISTERED", sinceIso),
    countTelemetryEvents(adminClient, "CHECKOUT_STARTED", sinceIso),
    countTelemetryEvents(adminClient, "PURCHASE_COMPLETED", sinceIso),
    countTelemetryEvents(adminClient, "PURCHASE_FAILED", sinceIso),
    countTelemetryEvents(adminClient, "LIVEKIT_TOKEN_ISSUED", sinceIso),
    countTelemetryEvents(adminClient, "LIVEKIT_TOKEN_FAILED", sinceIso),
    countPaymentLedger(adminClient, "succeeded", sinceIso),
    countPaymentLedger(adminClient, "failed", sinceIso),
  ]);

  return NextResponse.json({
    ok: true,
    hours,
    since: sinceIso,
    activation: {
      signup_started: signupStarted,
      signup_completed: signupCompleted,
      signup_failed: signupFailed,
      login_completed: loginCompleted,
      login_failed: loginFailed,
      profile_completed: profileCompleted,
      activated_total: battleCompleted + tournamentRegistered + purchaseCompleted,
    },
    queue: {
      queue_joined: queueJoined,
      ttfm_p50: metrics.ttfm_p50,
      ttfm_p90: metrics.ttfm_p90,
      ttfm_p95: metrics.ttfm_p95,
      ttfm_p99: metrics.ttfm_p99,
    },
    battles: {
      battle_started: battleStarted,
      battle_completed: battleCompleted,
      rematch_rate: metrics.rematch_rate,
      rage_quit_rate: metrics.rage_quit_rate,
      disconnect_rate: metrics.disconnect_rate,
    },
    tournaments: {
      tournament_registered: tournamentRegistered,
    },
    revenue: {
      checkout_started: checkoutStarted,
      purchase_completed: purchaseCompleted,
      purchase_failed: purchaseFailed,
      ledger_succeeded: revenueSucceeded,
      ledger_failed: revenueFailed,
    },
    infrastructure: {
      livekit_token_issued: livekitIssued,
      livekit_token_failed: livekitFailed,
      governance_block_rate: metrics.governance_block_rate,
      circuit_breaker_open_rate: metrics.circuit_breaker_open_rate,
      fairness_violation_rate: metrics.fairness_violation_rate,
    },
  });
}
