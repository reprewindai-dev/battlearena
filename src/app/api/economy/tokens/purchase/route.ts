import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { getTokenPackageByTokenCount } from "@/lib/payments/catalog";
import { getOrCreateStripeCustomerId } from "@/lib/payments/billing-store";
import { getStripeClient } from "@/lib/payments/stripe";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const PurchaseSchema = z.object({
  token_package: z.number().int().positive(),
  payment_method: z.enum(["card"]).default("card"),
  currency: z.enum(["USD"]).default("USD"),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = PurchaseSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const tokenPackage = getTokenPackageByTokenCount(parsed.data.token_package);
    if (!tokenPackage) {
      return NextResponse.json({ error: "unsupported_token_package" }, { status: 400 });
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
      `token_purchase:${user.id}:${Date.now()}:${randomUUID().slice(0, 8)}`;

    const { data: existing } = await adminClient
      .from("payment_ledger")
      .select("id,stripe_payment_intent_id,tokens,status")
      .eq("user_id", user.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing?.stripe_payment_intent_id) {
      const existingIntent = await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id);
      return NextResponse.json({
        payment_intent_client_secret: existingIntent.client_secret,
        payment_intent_id: existingIntent.id,
        amount_cents: existingIntent.amount,
        currency: existingIntent.currency.toUpperCase(),
        token_package: tokenPackage.tokens,
        bonus_tokens: tokenPackage.bonusTokens,
        total_tokens: existing.tokens,
        status: existing.status,
        idempotency_key: idempotencyKey,
      });
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: tokenPackage.amountCents,
        currency: "usd",
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          payment_kind: "token_purchase",
          user_id: user.id,
          token_package: String(tokenPackage.tokens),
          bonus_tokens: String(tokenPackage.bonusTokens),
          total_tokens: String(tokenPackage.tokens + tokenPackage.bonusTokens),
        },
      },
      {
        idempotencyKey,
      },
    );

    const { error: ledgerInsertError } = await adminClient
      .from("payment_ledger")
      .upsert(
        {
          user_id: user.id,
          payment_kind: "token_purchase",
          status: "pending",
          amount_cents: tokenPackage.amountCents,
          currency: tokenPackage.currency,
          tokens: tokenPackage.tokens + tokenPackage.bonusTokens,
          token_package: tokenPackage.tokens,
          bonus_tokens: tokenPackage.bonusTokens,
          stripe_customer_id: customerId,
          stripe_payment_intent_id: paymentIntent.id,
          idempotency_key: idempotencyKey,
          metadata: {
            payment_method: parsed.data.payment_method,
            source: "api/economy/tokens/purchase",
          },
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
      payment_intent_client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      token_package: tokenPackage.tokens,
      bonus_tokens: tokenPackage.bonusTokens,
      total_tokens: tokenPackage.tokens + tokenPackage.bonusTokens,
      status: "pending",
      idempotency_key: idempotencyKey,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "token_purchase_create_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
