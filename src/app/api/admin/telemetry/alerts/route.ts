import { NextRequest, NextResponse } from "next/server";

import { env } from "@/env";
import { getSessionRole } from "@/lib/auth/session";
import { deliverOpsAlert } from "@/lib/notifications/system";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { TelemetrySystem } from "@/lib/telemetry/TelemetrySystem";

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

  return NextResponse.json({ ok: true, metrics, triggered, cronAuthed });
}
