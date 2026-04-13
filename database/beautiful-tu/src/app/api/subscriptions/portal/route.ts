import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { getStripeClient } from "@/lib/payments/stripe";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

function resolveReturnUrl(request: Request) {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (configuredAppUrl) {
    return new URL("/app/billing", configuredAppUrl).toString();
  }

  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const protocol = forwardedProto || requestUrl.protocol.replace(":", "") || "https";
    return `${protocol}://${forwardedHost}/app/billing`;
  }

  return new URL("/app/billing", requestUrl.origin).toString();
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const adminClient = createSupabaseServiceRoleClient();
    const { data: billingProfile, error: billingError } = await adminClient
      .from("user_billing_profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle<{ stripe_customer_id: string | null }>();

    if (billingError) {
      return NextResponse.json({ error: "billing_profile_lookup_failed", details: billingError.message }, { status: 500 });
    }

    if (!billingProfile?.stripe_customer_id) {
      return NextResponse.json({ error: "stripe_customer_not_found" }, { status: 404 });
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: billingProfile.stripe_customer_id,
      return_url: resolveReturnUrl(request),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      {
        error: "billing_portal_session_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
