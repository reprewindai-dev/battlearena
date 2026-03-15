import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingProfileRow = {
  user_id: string;
  stripe_customer_id: string | null;
};

export async function getOrCreateStripeCustomerId(params: {
  adminClient: SupabaseClient;
  stripe: Stripe;
  userId: string;
  email: string | null;
}) {
  const { adminClient, stripe, userId, email } = params;

  const { data: existing, error: existingError } = await adminClient
    .from("user_billing_profiles")
    .select("user_id,stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`billing_profile_lookup_failed:${existingError.message}`);
  }

  const existingRow = existing as BillingProfileRow | null;
  if (existingRow?.stripe_customer_id) {
    return existingRow.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      user_id: userId,
    },
  });

  const { error: upsertError } = await adminClient
    .from("user_billing_profiles")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    throw new Error(`billing_profile_upsert_failed:${upsertError.message}`);
  }

  return customer.id;
}
