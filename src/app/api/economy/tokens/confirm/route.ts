import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { markReferralActivated } from "@/lib/growth/referrals";
import { createRequestLogContext, logStructured, withRequestId } from "@/lib/logging/structured";
import { sendSystemNotification } from "@/lib/notifications/system";
import { getStripeClient } from "@/lib/payments/stripe";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";

const ConfirmSchema = z.object({
  payment_intent_id: z.string().min(8),
});

type FinalizeResult = {
  ok?: boolean;
  error?: string;
  idempotent?: boolean;
  new_balance?: number;
  tokens_granted?: number;
};

export async function POST(request: Request) {
  const logContext = createRequestLogContext(request, "/api/economy/tokens/confirm");
  try {
    const user = await getSessionUser();
    if (!user) {
      logStructured("warn", "token_purchase_confirm_unauthenticated", logContext);
      return withRequestId(
        NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
        logContext.request_id,
      );
    }
    logContext.user_id = user.id;

    const body = await request.json().catch(() => ({}));
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) {
      logStructured("warn", "token_purchase_confirm_invalid_request", logContext, {
        validation_error: parsed.error.flatten(),
      });
      return withRequestId(
        NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 },
        ),
        logContext.request_id,
      );
    }

    const stripe = getStripeClient();
    const adminClient = createSupabaseServiceRoleClient();

    const paymentIntent = await stripe.paymentIntents.retrieve(parsed.data.payment_intent_id);
    if (paymentIntent.metadata.user_id !== user.id) {
      logStructured("warn", "token_purchase_confirm_forbidden", logContext, {
        payment_intent_id: paymentIntent.id,
      });
      return withRequestId(
        NextResponse.json({ error: "forbidden" }, { status: 403 }),
        logContext.request_id,
      );
    }

    if (paymentIntent.status !== "succeeded") {
      logStructured("warn", "token_purchase_confirm_not_settled", logContext, {
        payment_intent_id: paymentIntent.id,
        payment_status: paymentIntent.status,
      });
      return withRequestId(
        NextResponse.json(
        {
          ok: false,
          status: paymentIntent.status,
          error: "payment_not_settled",
        },
        { status: 409 },
        ),
        logContext.request_id,
      );
    }

    const { data: ledger, error: ledgerError } = await adminClient
      .from("payment_ledger")
      .select("id,status")
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ledgerError) {
      logStructured("error", "token_purchase_confirm_ledger_lookup_failed", logContext, {
        payment_intent_id: paymentIntent.id,
        error: ledgerError.message,
      });
      return withRequestId(
        NextResponse.json(
        { error: "ledger_lookup_failed", details: ledgerError.message },
        { status: 500 },
        ),
        logContext.request_id,
      );
    }

    const ledgerRow = ledger as { id: string; status: string } | null;
    if (!ledgerRow) {
      logStructured("warn", "token_purchase_confirm_payment_not_found", logContext, {
        payment_intent_id: paymentIntent.id,
      });
      return withRequestId(
        NextResponse.json({ error: "payment_not_found" }, { status: 404 }),
        logContext.request_id,
      );
    }

    if (ledgerRow.status === "succeeded") {
      logStructured("info", "token_purchase_confirm_idempotent", logContext, {
        payment_intent_id: paymentIntent.id,
      });
      return withRequestId(
        NextResponse.json({ ok: true, idempotent: true }),
        logContext.request_id,
      );
    }

    const { data: finalizeResult, error: finalizeError } = await adminClient.rpc(
      "finalize_token_purchase_ledger",
      { p_ledger_id: ledgerRow.id },
    );

    if (finalizeError) {
      logStructured("error", "token_purchase_confirm_finalize_failed", logContext, {
        payment_intent_id: paymentIntent.id,
        error: finalizeError.message,
      });
      return withRequestId(
        NextResponse.json(
        { error: "payment_finalize_failed", details: finalizeError.message },
        { status: 500 },
        ),
        logContext.request_id,
      );
    }

    const typedFinalize = (finalizeResult ?? {}) as FinalizeResult;
    if (!typedFinalize.ok) {
      await getTelemetrySystem()
        .emitEvent({
          event_type: "PURCHASE_FAILED",
          player_id: user.id,
          event_data: {
            payment_intent_id: paymentIntent.id,
            error: typedFinalize.error ?? "unknown_error",
          },
        })
        .catch(() => null);

      logStructured("warn", "token_purchase_confirm_rejected", logContext, {
        payment_intent_id: paymentIntent.id,
        error: typedFinalize.error ?? "unknown_error",
      });
      return withRequestId(
        NextResponse.json(
        {
          error: "payment_finalize_rejected",
          details: typedFinalize.error ?? "unknown_error",
        },
        { status: 409 },
        ),
        logContext.request_id,
      );
    }

    await getTelemetrySystem()
      .emitEvent({
        event_type: "PURCHASE_COMPLETED",
        player_id: user.id,
        event_data: {
          payment_intent_id: paymentIntent.id,
          new_balance: typedFinalize.new_balance ?? null,
          tokens_granted: typedFinalize.tokens_granted ?? null,
          idempotent: Boolean(typedFinalize.idempotent),
        },
      })
      .catch(() => null);

    await sendSystemNotification(adminClient, {
      userId: user.id,
      title: "Purchase confirmed",
      body: `Your token purchase is complete and ${typedFinalize.tokens_granted ?? 0} tokens are available on your account.`,
      link: "/app/shop",
    }).catch(() => null);

    await markReferralActivated(adminClient, user.id, "first_purchase").catch(() => null);

    logStructured("info", "token_purchase_confirmed", logContext, {
      payment_intent_id: paymentIntent.id,
      tokens_granted: typedFinalize.tokens_granted ?? null,
      new_balance: typedFinalize.new_balance ?? null,
    });

    return withRequestId(
      NextResponse.json({
        ok: true,
        idempotent: Boolean(typedFinalize.idempotent),
        newTokenBalance:
          typeof typedFinalize.new_balance === "number"
            ? typedFinalize.new_balance
            : null,
        tokensGranted:
          typeof typedFinalize.tokens_granted === "number"
            ? typedFinalize.tokens_granted
            : null,
      }),
      logContext.request_id,
    );
  } catch (error) {
    logStructured("error", "token_purchase_confirm_failed", logContext, {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return withRequestId(
      NextResponse.json(
      {
        error: "token_purchase_confirm_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
      ),
      logContext.request_id,
    );
  }
}
