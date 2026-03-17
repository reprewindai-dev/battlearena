"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { PLANS, type PlanType } from "@/lib/billing/stripe";

type SubscriptionCardProps = {
  plan: PlanType;
  currentPlan?: PlanType;
  onUpgrade: (plan: PlanType) => void;
  isLoading?: boolean;
};

export function SubscriptionCard({ plan, currentPlan, onUpgrade, isLoading }: SubscriptionCardProps) {
  const planData = PLANS[plan];
  const isCurrentPlan = currentPlan === plan;
  const isUpgrade = plan !== "free" && (!currentPlan || currentPlan === "free");

  return (
    <Card className={`relative ${isCurrentPlan ? "border-primary" : ""}`}>
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge variant="default" className="bg-primary text-primary-foreground">
            Current Plan
          </Badge>
        </div>
      )}
      
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">{planData.name}</CardTitle>
        <CardDescription className="text-3xl font-bold">
          ${planData.price}
          <span className="text-lg font-normal text-muted-foreground">/month</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {planData.features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {plan === "free" && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Video/audio battles</span>
            </div>
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Advanced analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Tournament hosting</span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          variant={isCurrentPlan ? "outline" : "default"}
          disabled={isCurrentPlan || isLoading || !isUpgrade}
          onClick={() => onUpgrade(plan)}
        >
          {isCurrentPlan ? "Current Plan" : isUpgrade ? "Upgrade" : "Downgrade"}
        </Button>
      </CardFooter>
    </Card>
  );
}
