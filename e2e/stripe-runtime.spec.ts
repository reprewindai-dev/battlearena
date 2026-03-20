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

type LedgerRow = {
  id: string;
  status: string;
  tokens: number;
  stripe_payment_intent_id: string | null;
  stripe_subscription_id: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const hasAdminEnv = Boolean(supabaseUrl && serviceRoleKey);
const hasStripeTestEnv = Boolean(stripeSecretKey && stripeSecretKey.startsWith("sk_test_"));

const adminClient = hasAdminEnv
  ? createClient(supabaseUrl as string, serviceRoleKey as string)
  : null;
const stripe = hasStripeTestEnv ? new Stripe(stripeSecretKey as string) : null;

const createdUserIds: string[] = [];
const createdSubscriptionIds: string[] = [];

function requireAdminClient() {
  if (!adminClient) {
    throw new Error("stripe_runtime_env_missing");
  }
  return adminClient;
}

function requireStripe() {
  if (!stripe) {
    throw new Error("stripe_test_secret_missing");
  }
  return stripe;
}

function randomSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

async function createVerifiedUser(prefix: string): Promise<Credentials> {
  const client = requireAdminClient();
  const email = `${prefix}_${randomSuffix()}@battlearena-e2e.local`;
  const password = `E2E_${randomSuffix()}_Strong!`;

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "user" },
    user_metadata: { role: "user" },
  });

  if (error || !data.user) {
    throw new Error(`failed_to_create_stripe_user:${error?.message ?? "unknown"}`);
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

async function getTokenBalance(userId: string) {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("user_profiles")
    .select("token_balance")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`token_balance_lookup_failed:${error.message}`);
  }

  return Number(data.token_balance ?? 0);
}

async function getLatestLedger(userId: string, paymentKind: "token_purchase" | "subscription") {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("payment_ledger")
    .select("id,status,tokens,stripe_payment_intent_id,stripe_subscription_id")
    .eq("user_id", userId)
    .eq("payment_kind", paymentKind)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    throw new Error(`payment_ledger_lookup_failed:${error.message}`);
  }

  return data as LedgerRow;
}

test.afterAll(async () => {
  if (!adminClient) return;

  if (stripe && createdSubscriptionIds.length > 0) {
    for (const subscriptionId of createdSubscriptionIds) {
      try {
        await stripe.subscriptions.cancel(subscriptionId);
      } catch {
        // ignore cleanup failures
      }
    }
  }

  if (createdUserIds.length > 0) {
    await adminClient.from("payment_ledger").delete().in("user_id", createdUserIds);
    await adminClient.from("user_billing_profiles").delete().in("user_id", createdUserIds);
    await adminClient.from("users").delete().in("id", createdUserIds);
    await adminClient.from("user_profiles").delete().in("id", createdUserIds);

    for (const userId of createdUserIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  }
});

test.describe("stripe runtime verification", () => {
  test.skip(!hasAdminEnv, "Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  test.skip(!hasStripeTestEnv, "Requires STRIPE_SECRET_KEY in test mode for automated payment verification.");

  test("token purchases reconcile through Stripe webhook and token shop mounts checkout on Render", async ({ browser }) => {
    const user = await createVerifiedUser("stripe_tokens");
    const client = requireAdminClient();
    const stripeClient = requireStripe();

    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, user);

    await page.goto("/app/shop");
    await page.getByRole("button", { name: "Purchase" }).first().click();
    await expect(page.getByTestId("stripe-payment-element")).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "Cancel" }).click();

    const balanceBefore = await getTokenBalance(user.id);

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
    };
    expect(purchaseBody.payment_intent_id).toBeTruthy();
    expect(purchaseBody.total_tokens).toBe(100);
    expect(purchaseBody.status).toBe("pending");

    const confirmIntent = await stripeClient.paymentIntents.confirm(purchaseBody.payment_intent_id, {
      payment_method: "pm_card_visa",
    });
    expect(confirmIntent.status).toBe("succeeded");

    await expect
      .poll(async () => {
        const ledger = await getLatestLedger(user.id, "token_purchase");
        return ledger.status;
      }, { timeout: 90000, intervals: [1000, 2000, 5000] })
      .toBe("succeeded");

    await expect
      .poll(async () => {
        return getTokenBalance(user.id);
      }, { timeout: 90000, intervals: [1000, 2000, 5000] })
      .toBe(balanceBefore + 100);

    const ledger = await getLatestLedger(user.id, "token_purchase");
    expect(ledger.stripe_payment_intent_id).toBe(purchaseBody.payment_intent_id);

    const { data: webhookLedgerRow } = await client
      .from("payment_ledger")
      .select("completed_at")
      .eq("id", ledger.id)
      .single();
    expect(webhookLedgerRow?.completed_at).toBeTruthy();

    await context.close();
  });

  test("subscriptions reconcile billing profile through Stripe webhook", async ({ browser }) => {
    const user = await createVerifiedUser("stripe_subscription");
    const stripeClient = requireStripe();

    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, user);

    const response = await page.request.post("/api/subscriptions/create", {
      data: {
        plan_id: "spectator",
        payment_method: "card",
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as {
      subscription_id: string;
      status: string;
      plan_id: string;
      client_secret?: string | null;
    };
    expect(body.subscription_id).toBeTruthy();
    expect(body.plan_id).toBe("spectator");
    createdSubscriptionIds.push(body.subscription_id);

    const subscription = await stripeClient.subscriptions.retrieve(body.subscription_id, {
      expand: ["latest_invoice.payment_intent"],
    });

    const invoice = typeof subscription.latest_invoice === "string" ? null : subscription.latest_invoice;
    const paymentIntent =
      invoice &&
      typeof (invoice as { payment_intent?: unknown }).payment_intent !== "string"
        ? ((invoice as { payment_intent?: Stripe.PaymentIntent | null }).payment_intent ?? null)
        : null;

    expect(paymentIntent?.id).toBeTruthy();
    const confirmedIntent = await stripeClient.paymentIntents.confirm(paymentIntent!.id, {
      payment_method: "pm_card_visa",
    });
    expect(confirmedIntent.status).toBe("succeeded");

    await expect
      .poll(async () => {
        const client = requireAdminClient();
        const { data } = await client
          .from("user_billing_profiles")
          .select("active_subscription_plan,active_subscription_status,stripe_subscription_id")
          .eq("user_id", user.id)
          .maybeSingle();
        return data?.active_subscription_status ?? null;
      }, { timeout: 90000, intervals: [1000, 2000, 5000] })
      .toBe("active");

    await expect
      .poll(async () => {
        const ledger = await getLatestLedger(user.id, "subscription");
        return ledger.status;
      }, { timeout: 90000, intervals: [1000, 2000, 5000] })
      .toBe("succeeded");

    const client = requireAdminClient();
    const { data: billingProfile } = await client
      .from("user_billing_profiles")
      .select("active_subscription_plan,active_subscription_status,stripe_subscription_id")
      .eq("user_id", user.id)
      .single();

    expect(billingProfile?.active_subscription_plan).toBe("spectator");
    expect(billingProfile?.active_subscription_status).toBe("active");
    expect(billingProfile?.stripe_subscription_id).toBe(body.subscription_id);

    await context.close();
  });
});
