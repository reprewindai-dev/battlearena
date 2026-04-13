import { NextRequest, NextResponse } from "next/server";

import { env } from "@/env";
import { getSessionRole } from "@/lib/auth/session";
import { deliverOpsAlert } from "@/lib/notifications/system";
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

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const cronAuthed = Boolean(env.OPS_ALERTS_SECRET && cronSecret === env.OPS_ALERTS_SECRET);
  const role = cronAuthed ? "admin" : await getSessionRole();

  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const telemetry = new TelemetrySystem();
  const metrics = await telemetry.getMetricsDashboard(60 * 60 * 1000);
  const adminClient = createSupabaseServiceRoleClient();
  const triggered: string[] = [];
  const since15m = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const [
    signupFailed15m,
    loginFailed15m,
    livekitFailed15m,
    purchaseFailed15m,
    tournamentRegistrationFailed15m,
  ] = await Promise.all([
    countTelemetryEvents(adminClient, "SIGNUP_FAILED", since15m),
    countTelemetryEvents(adminClient, "LOGIN_FAILED", since15m),
    countTelemetryEvents(adminClient, "LIVEKIT_TOKEN_FAILED", since15m),
    countTelemetryEvents(adminClient, "PURCHASE_FAILED", since15m),
    countTelemetryEvents(adminClient, "TOURNAMENT_REGISTRATION_FAILED", since15m),
  ]);

  if (metrics.ttfm_p90 > 20_000) {
    await deliverOpsAlert(adminClient, {
      code: "telemetry_ttfm_p90_high",
      severity: "warning",
      title: "Queue-to-match latency is above threshold",
      body: `TTFM p90 is ${metrics.ttfm_p90}ms for the last hour, above the 20000ms threshold.`,
      payload: metrics as unknown as Record<string, unknown>,
      throttleMs: 30 * 60 * 1000,
    });
    triggered.push("ttfm_p90");
  }

  if (metrics.disconnect_rate > 0.08) {
    await deliverOpsAlert(adminClient, {
      code: "telemetry_disconnect_rate_high",
      severity: "critical",
      title: "Disconnect rate is above threshold",
      body: `Disconnect rate reached ${(metrics.disconnect_rate * 100).toFixed(1)}% over the last hour.`,
      payload: metrics as unknown as Record<string, unknown>,
      throttleMs: 15 * 60 * 1000,
    });
    triggered.push("disconnect_rate");
  }

  if (metrics.governance_block_rate > 0.15) {
    await deliverOpsAlert(adminClient, {
      code: "telemetry_governance_block_rate_high",
      severity: "warning",
      title: "Governance block rate is above threshold",
      body: `Governance blocked ${(metrics.governance_block_rate * 100).toFixed(1)}% of plans over the last hour.`,
      payload: metrics as unknown as Record<string, unknown>,
      throttleMs: 15 * 60 * 1000,
    });
    triggered.push("governance_block_rate");
  }

  if (signupFailed15m >= 5) {
    await deliverOpsAlert(adminClient, {
      code: "telemetry_signup_failed_spike",
      severity: "warning",
      title: "Signup failures spiked",
      body: `Signup failures reached ${signupFailed15m} in the last 15 minutes.`,
      payload: { signupFailed15m },
      throttleMs: 15 * 60 * 1000,
    });
    triggered.push("signup_failed");
  }

  if (loginFailed15m >= 8) {
    await deliverOpsAlert(adminClient, {
      code: "telemetry_login_failed_spike",
      severity: "critical",
      title: "Login failures spiked",
      body: `Login failures reached ${loginFailed15m} in the last 15 minutes.`,
      payload: { loginFailed15m },
      throttleMs: 10 * 60 * 1000,
    });
    triggered.push("login_failed");
  }

  if (livekitFailed15m >= 5) {
    await deliverOpsAlert(adminClient, {
      code: "telemetry_livekit_failed_spike",
      severity: "critical",
      title: "LiveKit token issuance failures spiked",
      body: `LiveKit token issuance failed ${livekitFailed15m} times in the last 15 minutes.`,
      payload: { livekitFailed15m },
      throttleMs: 10 * 60 * 1000,
    });
    triggered.push("livekit_failed");
  }

  if (purchaseFailed15m >= 3) {
    await deliverOpsAlert(adminClient, {
      code: "telemetry_purchase_failed_spike",
      severity: "critical",
      title: "Purchase confirmations are failing",
      body: `Purchase confirmation failures reached ${purchaseFailed15m} in the last 15 minutes.`,
      payload: { purchaseFailed15m },
      throttleMs: 10 * 60 * 1000,
    });
    triggered.push("purchase_failed");
  }

  if (tournamentRegistrationFailed15m >= 3) {
    await deliverOpsAlert(adminClient, {
      code: "telemetry_tournament_registration_failed_spike",
      severity: "critical",
      title: "Tournament registration failures spiked",
      body: `Tournament registration failures reached ${tournamentRegistrationFailed15m} in the last 15 minutes.`,
      payload: { tournamentRegistrationFailed15m },
      throttleMs: 10 * 60 * 1000,
    });
    triggered.push("tournament_registration_failed");
  }

  return NextResponse.json({ ok: true, metrics, triggered, cronAuthed });
}
