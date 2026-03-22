import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type Credentials = {
  id: string;
  email: string;
  password: string;
};

type BillingProfileRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  active_subscription_status: string | null;
};

type PaymentLedgerRow = {
  id: string;
  status: string;
  stripe_payment_intent_id: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const hasAdminEnv = Boolean(supabaseUrl && serviceRoleKey);
const hasStripeEnv = Boolean(stripeSecretKey);

const adminClient = hasAdminEnv
  ? createClient(supabaseUrl as string, serviceRoleKey as string)
  : null;
const stripe = hasStripeEnv ? new Stripe(stripeSecretKey as string) : null;

const createdUserIds: string[] = [];
const createdPaymentIntentIds: string[] = [];
const createdSubscriptionIds: string[] = [];

function requireAdminClient() {
  if (!adminClient) {
    throw new Error("stripe_live_smoke_env_missing");
  }

  return adminClient;
}

function requireStripe() {
  if (!stripe) {
    throw new Error("stripe_secret_missing");
  }

  return stripe;
}

function randomSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

async function createVerifiedUser(prefix: string): Promise<Credentials> {
  const client = requireAdminClient();
  const email = `${prefix}_${randomSuffix()}@spitzone-e2e.local`;
  const password = `E2E_${randomSuffix()}_Strong!`;

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "user" },
    user_metadata: { role: "user" },
  });

  if (error || !data.user) {
    throw new Error(`failed_to_create_stripe_live_user:${error?.message ?? "unknown"}`);
  }

  createdUserIds.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function login(page: Page, credentials: Credentials) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
}

async function bootstrapPublicIdentity(page: Page) {
  const response = await page.request.get("/api/profile/me");
  expect(response.status()).toBe(200);
}

async function getLatestPaymentLedger(userId: string) {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("payment_ledger")
    .select("id,status,stripe_payment_intent_id")
    .eq("user_id", userId)
    .eq("payment_kind", "token_purchase")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    throw new Error(`payment_ledger_lookup_failed:${error.message}`);
  }

  return data as PaymentLedgerRow;
}

async function getBillingProfile(userId: string) {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("user_billing_profiles")
    .select("stripe_customer_id,stripe_subscription_id,active_subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`billing_profile_lookup_failed:${error.message}`);
  }

  return (data ?? {
    stripe_customer_id: null,
    stripe_subscription_id: null,
    active_subscription_status: null,
  }) as BillingProfileRow;
}

test.afterAll(async () => {
  if (stripe) {
    for (const paymentIntentId of createdPaymentIntentIds) {
      try {
        await stripe.paymentIntents.cancel(paymentIntentId);
      } catch {
        // ignore cleanup failures
      }
    }

    for (const subscriptionId of createdSubscriptionIds) {
      try {
        await stripe.subscriptions.cancel(subscriptionId);
      } catch {
        // ignore cleanup failures
      }
    }
  }

  if (!adminClient || createdUserIds.length === 0) return;

  await adminClient.from("payment_ledger").delete().in("user_id", createdUserIds);
  await adminClient.from("user_billing_profiles").delete().in("user_id", createdUserIds);
  await adminClient.from("user_profiles").delete().in("user_id", createdUserIds);
  await adminClient.from("users").delete().in("id", createdUserIds);

  for (const userId of createdUserIds) {
    await adminClient.auth.admin.deleteUser(userId);
  }
});

test.describe("stripe live smoke verification", () => {
  test.skip(!hasAdminEnv, "Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  test.skip(!hasStripeEnv, "Requires STRIPE_SECRET_KEY.");

  test("token checkout mounts and creates a cancelable live payment intent", async ({ browser }) => {
    const user = await createVerifiedUser("stripe_live_tokens");
    const stripeClient = requireStripe();

    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, user);
    await bootstrapPublicIdentity(page);

    const purchaseResponse = await page.request.post("/api/economy/tokens/purchase", {
      data: {
        token_package: 100,
        payment_method: "card",
        currency: "USD",
      },
    });

    expect(purchaseResponse.ok()).toBeTruthy();
    const purchaseBody = (await purchaseResponse.json()) as {
      payment_intent_id: string;
      total_tokens: number;
      status: string;
      client_secret?: string | null;
    };

    expect(purchaseBody.payment_intent_id).toBeTruthy();
    expect(purchaseBody.total_tokens).toBe(100);
    expect(purchaseBody.status).toBe("pending");
    createdPaymentIntentIds.push(purchaseBody.payment_intent_id);

    await page.goto("/app/shop");
    await page.getByRole("button", { name: "Purchase" }).first().click();
    await expect(page.getByTestId("stripe-payment-element")).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Cancel" }).click();

    const paymentIntent = await stripeClient.paymentIntents.retrieve(purchaseBody.payment_intent_id);
    expect(["requires_payment_method", "requires_confirmation", "requires_action", "processing"]).toContain(paymentIntent.status);

    const ledger = await getLatestPaymentLedger(user.id);
    expect(ledger.stripe_payment_intent_id).toBe(purchaseBody.payment_intent_id);
    expect(ledger.status).toBe("pending");

    await stripeClient.paymentIntents.cancel(purchaseBody.payment_intent_id);

    await context.close();
  });

  test("subscription checkout creates a cancelable live Stripe subscription shell", async ({ browser }) => {
    const user = await createVerifiedUser("stripe_live_subscription");
    const stripeClient = requireStripe();

    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, user);
    await bootstrapPublicIdentity(page);

    const response = await page.request.post("/api/subscriptions/create", {
      data: {
        plan_id: "spectator",
        payment_method: "card",
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as {
      subscription_id: string;
      plan_id: string;
      status: string;
      client_secret?: string | null;
    };

    expect(body.subscription_id).toBeTruthy();
    expect(body.plan_id).toBe("spectator");
    expect(body.client_secret).toBeTruthy();
    createdSubscriptionIds.push(body.subscription_id);

    const subscription = await stripeClient.subscriptions.retrieve(body.subscription_id, {
      expand: ["latest_invoice.payment_intent"],
    });
    expect(["incomplete", "trialing", "active", "past_due"]).toContain(subscription.status);

    const billingProfile = await getBillingProfile(user.id);
    expect(billingProfile.stripe_subscription_id).toBe(body.subscription_id);
    expect(billingProfile.stripe_customer_id).toBeTruthy();

    await stripeClient.subscriptions.cancel(body.subscription_id);

    await context.close();
  });
});
