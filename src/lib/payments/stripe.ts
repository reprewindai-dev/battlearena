import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("stripe_secret_key_missing");
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function getStripeSubscriptionPriceId(planId: "spectator" | "pro" | "premium") {
  if (planId === "spectator") {
    return process.env.STRIPE_PRICE_SUB_SPECTATOR_MONTHLY ?? null;
  }
  if (planId === "pro") {
    return process.env.STRIPE_PRICE_SUB_PRO_MONTHLY ?? null;
  }
  return process.env.STRIPE_PRICE_SUB_PREMIUM_MONTHLY ?? null;
}
