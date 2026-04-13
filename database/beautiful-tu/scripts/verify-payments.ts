#!/usr/bin/env node

import { config } from "dotenv";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.production" });
config({ path: ".env.local" });
config();

type Result = { name: string; ok: boolean; details?: string };

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class PaymentVerifier {
  private readonly stripe = new Stripe(required("STRIPE_SECRET_KEY"));
  private readonly supabase = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
  );

  private async verifyWebhookSigning(): Promise<Result> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return { name: "Webhook signature verification", ok: false, details: "missing STRIPE_WEBHOOK_SECRET" };
    }

    const payload = JSON.stringify({
      type: "payment_intent.succeeded",
      data: { object: { id: `pi_verify_${Date.now()}`, amount: 500, currency: "usd" } },
    });
    const header = this.stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });

    try {
      this.stripe.webhooks.constructEvent(payload, header, webhookSecret);
      return { name: "Webhook signature verification", ok: true };
    } catch (error: unknown) {
      return { name: "Webhook signature verification", ok: false, details: errMessage(error) };
    }
  }

  private async verifySchema(): Promise<Result[]> {
    const checks: Array<{ table: string; columns: string[] }> = [
      { table: "payment_ledger", columns: ["id", "user_id", "payment_kind", "status", "idempotency_key"] },
      { table: "battles", columns: ["entry_fee", "prize_pool"] },
    ];

    const results: Result[] = [];
    for (const check of checks) {
      const { data, error } = await this.supabase
        .from(check.table)
        .select(check.columns.join(","))
        .limit(1);

      if (error) {
        results.push({ name: `Schema check: ${check.table}`, ok: false, details: error.message });
        continue;
      }

      results.push({
        name: `Schema check: ${check.table}`,
        ok: Array.isArray(data),
      });
    }
    return results;
  }

  private async verifyStripeNetworkIfEnabled(): Promise<Result[]> {
    const key = process.env.STRIPE_SECRET_KEY ?? "";
    const networkChecksEnabled = process.env.VERIFY_STRIPE_NETWORK === "1";

    if (!networkChecksEnabled) {
      return [
        {
          name: "Stripe API connectivity",
          ok: true,
          details: "skipped (set VERIFY_STRIPE_NETWORK=1 to run live Stripe checks)",
        },
      ];
    }

    if (!key.startsWith("sk_test_")) {
      return [
        {
          name: "Stripe API connectivity",
          ok: false,
          details: "network checks require a test key (sk_test_*) to avoid live charges",
        },
      ];
    }

    const results: Result[] = [];

    try {
      await this.stripe.balance.retrieve();
      results.push({ name: "Stripe API connectivity", ok: true });
    } catch (error: unknown) {
      results.push({ name: "Stripe API connectivity", ok: false, details: errMessage(error) });
      return results;
    }

    try {
      const keyId = `verify_idem_${Date.now()}`;
      const a = await this.stripe.paymentIntents.create(
        {
          amount: 200,
          currency: "usd",
          payment_method: "pm_card_visa",
          confirm: true,
        },
        { idempotencyKey: keyId },
      );
      const b = await this.stripe.paymentIntents.create(
        {
          amount: 200,
          currency: "usd",
          payment_method: "pm_card_visa",
          confirm: true,
        },
        { idempotencyKey: keyId },
      );
      results.push({
        name: "Stripe idempotency behavior",
        ok: a.id === b.id,
        details: a.id === b.id ? undefined : `mismatch ${a.id} vs ${b.id}`,
      });
    } catch (error: unknown) {
      results.push({ name: "Stripe idempotency behavior", ok: false, details: errMessage(error) });
    }

    return results;
  }

  async run() {
    const results: Result[] = [];
    results.push(await this.verifyWebhookSigning());
    results.push(...(await this.verifySchema()));
    results.push(...(await this.verifyStripeNetworkIfEnabled()));

    const passed = results.filter((r) => r.ok).length;
    const failed = results.length - passed;

    console.log("Payment System Verification");
    console.log("=====================================");
    results.forEach((r) => console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.details ? ` (${r.details})` : ""}`));
    console.log("=====================================");
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  }
}

new PaymentVerifier()
  .run()
  .catch((error: unknown) => {
    console.error(errMessage(error));
    process.exitCode = 1;
  });
