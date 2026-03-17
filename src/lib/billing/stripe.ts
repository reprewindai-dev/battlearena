import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
  typescript: true,
});

export const PLANS = {
  free: {
    name: "Free",
    priceId: "price_free",
    price: 0,
    features: ["3 battles per month", "Basic features"],
    limits: { battlesPerMonth: 3, apiCallsPerMonth: 1000 },
  },
  pro: {
    name: "Pro",
    priceId: "price_pro_monthly",
    price: 9.99,
    features: ["Unlimited battles", "Video/audio", "Analytics", "Priority support"],
    limits: { battlesPerMonth: -1, apiCallsPerMonth: 10000 },
  },
  enterprise: {
    name: "Enterprise",
    priceId: "price_enterprise_monthly",
    price: 49.99,
    features: ["Everything in Pro", "Tournaments", "White-label", "API access", "Dedicated support"],
    limits: { battlesPerMonth: -1, apiCallsPerMonth: -1 },
  },
} as const;

export type PlanType = keyof typeof PLANS;

export async function createCheckoutSession(userId: string, planType: PlanType) {
  const plan = PLANS[planType];
  
  const session = await stripe.checkout.sessions.create({
    customer_email: undefined, // Will be set by customer creation
    billing_address_collection: "auto",
    line_items: [
      {
        price: plan.priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/cancel`,
    metadata: {
      userId,
      planType,
    },
  });

  return session;
}

export async function createCustomer(userId: string, email: string) {
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  return customer;
}

export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.cancel(subscriptionId);
}

export async function createPortalSession(customerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing`,
  });

  return session;
}
