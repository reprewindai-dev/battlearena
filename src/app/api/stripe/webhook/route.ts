import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripeClient } from "@/lib/payments/stripe";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "stripe_webhook_secret_missing" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid_signature",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }

  const adminClient = createSupabaseServiceRoleClient();

  try {
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      const { data: ledger } = await adminClient
        .from("payment_ledger")
        .select("id,payment_kind,status")
        .eq("stripe_payment_intent_id", paymentIntent.id)
        .maybeSingle<{ id: string; payment_kind: string; status: string }>();

      if (ledger?.payment_kind === "token_purchase") {
        const { error: finalizeError } = await adminClient.rpc("finalize_token_purchase_ledger", {
          p_ledger_id: ledger.id,
        });

        if (finalizeError) {
          throw new Error(`token_finalize_failed:${finalizeError.message}`);
        }
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await adminClient
        .from("payment_ledger")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", paymentIntent.id)
        .eq("status", "pending");
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const periodEnd = (subscription as unknown as { current_period_end?: number | null }).current_period_end;
      const userId = subscription.metadata.user_id;
      const planId = subscription.metadata.plan_id;

      if (userId) {
        await adminClient
          .from("user_billing_profiles")
          .upsert(
            {
              user_id: userId,
              stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
              stripe_subscription_id: subscription.id,
              active_subscription_plan: planId ?? null,
              active_subscription_status: subscription.status,
              subscription_current_period_end:
                typeof periodEnd === "number"
                  ? new Date(periodEnd * 1000).toISOString()
                  : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
      }

      await adminClient
        .from("payment_ledger")
        .update({
          status: subscription.status === "active" ? "succeeded" : subscription.status === "canceled" ? "canceled" : "pending",
          completed_at: subscription.status === "active" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id)
        .eq("payment_kind", "subscription");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "webhook_processing_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
