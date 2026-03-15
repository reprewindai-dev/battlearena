import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { getStripeClient } from "@/lib/payments/stripe";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

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
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const stripe = getStripeClient();
    const adminClient = createSupabaseServiceRoleClient();

    const paymentIntent = await stripe.paymentIntents.retrieve(parsed.data.payment_intent_id);
    if (paymentIntent.metadata.user_id !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        {
          ok: false,
          status: paymentIntent.status,
          error: "payment_not_settled",
        },
        { status: 409 },
      );
    }

    const { data: ledger, error: ledgerError } = await adminClient
      .from("payment_ledger")
      .select("id,status")
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ledgerError) {
      return NextResponse.json(
        { error: "ledger_lookup_failed", details: ledgerError.message },
        { status: 500 },
      );
    }

    const ledgerRow = ledger as { id: string; status: string } | null;
    if (!ledgerRow) {
      return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
    }

    if (ledgerRow.status === "succeeded") {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    const { data: finalizeResult, error: finalizeError } = await adminClient.rpc(
      "finalize_token_purchase_ledger",
      { p_ledger_id: ledgerRow.id },
    );

    if (finalizeError) {
      return NextResponse.json(
        { error: "payment_finalize_failed", details: finalizeError.message },
        { status: 500 },
      );
    }

    const typedFinalize = (finalizeResult ?? {}) as FinalizeResult;
    if (!typedFinalize.ok) {
      return NextResponse.json(
        {
          error: "payment_finalize_rejected",
          details: typedFinalize.error ?? "unknown_error",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "token_purchase_confirm_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
