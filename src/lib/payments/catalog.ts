export type TokenPackage = {
  id: string;
  tokens: number;
  bonusTokens: number;
  amountCents: number;
  currency: "USD";
};

export const TOKEN_PACKAGES: ReadonlyArray<TokenPackage> = [
  { id: "starter", tokens: 100, bonusTokens: 0, amountCents: 499, currency: "USD" },
  { id: "regular", tokens: 250, bonusTokens: 25, amountCents: 999, currency: "USD" },
  { id: "pro", tokens: 500, bonusTokens: 75, amountCents: 1999, currency: "USD" },
  { id: "elite", tokens: 1000, bonusTokens: 200, amountCents: 3499, currency: "USD" },
  { id: "legendary", tokens: 2500, bonusTokens: 625, amountCents: 7999, currency: "USD" },
] as const;

export type SubscriptionPlanId = "spectator" | "pro" | "premium";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  interval: "month";
  currency: "USD";
};

export const SUBSCRIPTION_PLANS: ReadonlyArray<SubscriptionPlan> = [
  { id: "spectator", interval: "month", currency: "USD" },
  { id: "pro", interval: "month", currency: "USD" },
  { id: "premium", interval: "month", currency: "USD" },
] as const;

export function getTokenPackageByTokenCount(tokenCount: number) {
  return TOKEN_PACKAGES.find((pkg) => pkg.tokens === tokenCount) ?? null;
}

export function getSubscriptionPlan(planId: string) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId) ?? null;
}
