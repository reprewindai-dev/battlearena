import { NextResponse } from "next/server";

const startedAt = Date.now();

function isConfigured(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET() {
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  const stripeWebhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_BILLING_WEBHOOK_SECRET;

  const checks = {
    supabase: isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL) && isConfigured(supabasePublicKey),
    livekit:
      isConfigured(process.env.NEXT_PUBLIC_LIVEKIT_URL) &&
      isConfigured(process.env.LIVEKIT_API_KEY) &&
      isConfigured(process.env.LIVEKIT_API_SECRET),
    stripe: isConfigured(process.env.STRIPE_SECRET_KEY) && isConfigured(stripeWebhookSecret),
  };

  const missingChecks = Object.entries(checks)
    .filter(([, configured]) => !configured)
    .map(([name]) => name);

  const status = missingChecks.length === 0 ? "ok" : "degraded";

  return NextResponse.json(
    {
      ok: true,
      status,
      service: "battle-arena-web",
      environment: process.env.NODE_ENV ?? "unknown",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      version: process.env.RENDER_GIT_COMMIT ?? process.env.GITHUB_SHA ?? "local",
      checks,
      missingChecks,
    },
    { status: 200 },
  );
}