"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubscriptionPlanId } from "@/lib/payments/catalog";

const PLAN_DISPLAY: Record<
  SubscriptionPlanId,
  {
    name: string;
    monthlyPriceLabel: string;
    features: string[];
    unavailableOnLowerTiers?: string[];
  }
> = {
  spectator: {
    name: "Spectator",
    monthlyPriceLabel: "$4.99",
    features: ["Watch battles live", "Community access", "Basic notifications"],
    unavailableOnLowerTiers: ["Creator monetization", "Tournament hosting", "Premium analytics"],
  },
  pro: {
    name: "Pro",
    monthlyPriceLabel: "$9.99",
    features: ["Unlimited battles", "Live video/audio", "Advanced analytics", "Priority support"],
  },
  premium: {
    name: "Premium",
    monthlyPriceLabel: "$19.99",
    features: ["Everything in Pro", "Tournament hosting", "Premium analytics", "Priority access"],
  },
};

type SubscriptionCardProps = {
  plan: SubscriptionPlanId;
  currentPlan?: SubscriptionPlanId | null;
  onUpgrade: (plan: SubscriptionPlanId) => void;
  isLoading?: boolean;
};

export function SubscriptionCard({
  plan,
  currentPlan,
  onUpgrade,
  isLoading = false,
}: SubscriptionCardProps) {
  const planData = PLAN_DISPLAY[plan];
  const isCurrentPlan = currentPlan === plan;
  const currentRank = currentPlan === "premium" ? 3 : currentPlan === "pro" ? 2 : currentPlan === "spectator" ? 1 : 0;
  const targetRank = plan === "premium" ? 3 : plan === "pro" ? 2 : 1;
  const isUpgrade = targetRank > currentRank;

  return (
    <Card className={`relative ${isCurrentPlan ? "border-primary" : ""}`}>
      {isCurrentPlan ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
          <Badge variant="default" className="bg-primary text-primary-foreground">
            Current Plan
          </Badge>
        </div>
      ) : null}

      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">{planData.name}</CardTitle>
        <CardDescription className="text-3xl font-bold">
          {planData.monthlyPriceLabel}
          <span className="text-lg font-normal text-muted-foreground">/month</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {planData.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {planData.unavailableOnLowerTiers?.length ? (
          <div className="space-y-2 border-t pt-4">
            {planData.unavailableOnLowerTiers.map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <X className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          variant={isCurrentPlan ? "outline" : "default"}
          disabled={isCurrentPlan || isLoading || !isUpgrade}
          onClick={() => onUpgrade(plan)}
        >
          {isCurrentPlan ? "Current Plan" : isUpgrade ? "Upgrade" : "Unavailable"}
        </Button>
      </CardFooter>
    </Card>
  );
}
