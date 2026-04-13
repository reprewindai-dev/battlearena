import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { getSubscriptionPlan } from "@/lib/payments/catalog";
import { getOrCreateStripeCustomerId } from "@/lib/payments/billing-store";
import { getStripeClient, getStripeSubscriptionPriceId } from "@/lib/payments/stripe";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const CreateSubscriptionSchema = z.object({
  plan_id: z.enum(["spectator", "pro", "premium"]),
  payment_method: z.enum(["card"]).default("card"),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = CreateSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const plan = getSubscriptionPlan(parsed.data.plan_id);
    if (!plan) {
      return NextResponse.json({ error: "unsupported_plan" }, { status: 400 });
    }

    const priceId = getStripeSubscriptionPriceId(plan.id);
    if (!priceId) {
      return NextResponse.json(
        {
          error: "stripe_price_not_configured",
          details: `Missing Stripe price for plan ${plan.id}`,
        },
        { status: 500 },
      );
    }

    const adminClient = createSupabaseServiceRoleClient();
    const stripe = getStripeClient();

    const customerId = await getOrCreateStripeCustomerId({
      adminClient,
      stripe,
      userId: user.id,
      email: user.email,
    });

    const headerIdempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    const idempotencyKey =
      headerIdempotencyKey ||
      parsed.data.idempotencyKey ||
      `subscription_create:${user.id}:${parsed.data.plan_id}:${Date.now()}:${randomUUID().slice(0, 8)}`;

    const { data: existing } = await adminClient
      .from("payment_ledger")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    const existingRow = existing as { stripe_subscription_id: string | null } | null;
    if (existingRow?.stripe_subscription_id) {
      const currentSubscription = await stripe.subscriptions.retrieve(existingRow.stripe_subscription_id, {
        expand: ["latest_invoice.payment_intent"],
      });

      const currentInvoice = typeof currentSubscription.latest_invoice === "string"
        ? null
        : currentSubscription.latest_invoice;
      const currentInvoiceWithPaymentIntent =
        currentInvoice as unknown as { payment_intent?: string | Stripe.PaymentIntent | null } | null;
      const currentPaymentIntent =
        currentInvoiceWithPaymentIntent &&
        typeof currentInvoiceWithPaymentIntent.payment_intent !== "string" &&
        currentInvoiceWithPaymentIntent.payment_intent
          ? currentInvoiceWithPaymentIntent.payment_intent
          : null;

      return NextResponse.json({
        subscription_id: currentSubscription.id,
        client_secret: currentPaymentIntent?.client_secret ?? null,
        status: currentSubscription.status,
        plan_id: parsed.data.plan_id,
      });
    }

    const subscription = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          user_id: user.id,
          plan_id: parsed.data.plan_id,
        },
      },
      {
        idempotencyKey,
      },
    );

    const invoice = typeof subscription.latest_invoice === "string" ? null : subscription.latest_invoice;
    const invoiceWithPaymentIntent =
      invoice as unknown as { payment_intent?: string | Stripe.PaymentIntent | null } | null;
    const paymentIntent =
      invoiceWithPaymentIntent &&
      typeof invoiceWithPaymentIntent.payment_intent !== "string" &&
      invoiceWithPaymentIntent.payment_intent
        ? invoiceWithPaymentIntent.payment_intent
        : null;

    const subscriptionPeriodEnd = (subscription as unknown as { current_period_end?: number | null }).current_period_end;

    const { error: upsertBillingError } = await adminClient
      .from("user_billing_profiles")
      .upsert(
        {
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          active_subscription_plan: parsed.data.plan_id,
          active_subscription_status: subscription.status,
          subscription_current_period_end:
            typeof subscriptionPeriodEnd === "number"
              ? new Date(subscriptionPeriodEnd * 1000).toISOString()
              : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (upsertBillingError) {
      return NextResponse.json(
        { error: "billing_profile_write_failed", details: upsertBillingError.message },
        { status: 500 },
      );
    }

    const { error: ledgerInsertError } = await adminClient.from("payment_ledger").upsert(
      {
        user_id: user.id,
        payment_kind: "subscription",
        status: subscription.status === "active" ? "succeeded" : "pending",
        amount_cents: plan.id === "spectator" ? 499 : plan.id === "pro" ? 999 : 1999,
        currency: plan.currency,
        tokens: 0,
        subscription_plan: parsed.data.plan_id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_invoice_id: typeof subscription.latest_invoice === "string" ? subscription.latest_invoice : subscription.latest_invoice?.id,
        idempotency_key: idempotencyKey,
        metadata: {
          payment_method: parsed.data.payment_method,
          source: "api/subscriptions/create",
          stripe_price_id: priceId,
        },
        completed_at: subscription.status === "active" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "idempotency_key" },
    );

    if (ledgerInsertError) {
      return NextResponse.json(
        { error: "ledger_write_failed", details: ledgerInsertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      subscription_id: subscription.id,
      client_secret: paymentIntent?.client_secret ?? null,
      status: subscription.status,
      plan_id: parsed.data.plan_id,
      idempotency_key: idempotencyKey,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "subscription_create_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
