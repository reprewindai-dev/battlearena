"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import type { SubscriptionPlanId } from "@/lib/payments/catalog";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { toast } from "sonner";

type UserProfile = {
  active_subscription_plan: SubscriptionPlanId | null;
  active_subscription_status: string | null;
  subscription_current_period_end: string | null;
  stripe_customer_id: string | null;
};

const PLAN_LIMITS: Record<SubscriptionPlanId, { battlesPerMonth: string; apiCallsPerMonth: string }> = {
  spectator: { battlesPerMonth: "Watch-only", apiCallsPerMonth: "Basic" },
  pro: { battlesPerMonth: "Unlimited", apiCallsPerMonth: "10,000" },
  premium: { battlesPerMonth: "Unlimited", apiCallsPerMonth: "Unlimited" },
};

export default function BillingPage() {
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUpgrading, setIsUpgrading] = React.useState(false);

  const supabase = createSupabaseBrowserClient();

  React.useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("user_billing_profiles")
          .select("active_subscription_plan, active_subscription_status, subscription_current_period_end, stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle();

        setProfile(profile ?? {
          active_subscription_plan: null,
          active_subscription_status: null,
          subscription_current_period_end: null,
          stripe_customer_id: null,
        });
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [supabase]);

  async function handleUpgrade(plan: SubscriptionPlanId) {
    setIsUpgrading(true);
    try {
      const response = await fetch("/api/subscriptions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan_id: plan }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string; client_secret?: string | null; status?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to create subscription");
      }

      if (data?.status === "active") {
        toast.success("Subscription activated.");
        return;
      }

      if (data?.client_secret) {
        toast.success("Subscription created. Complete payment in Stripe Elements flow.");
        return;
      }

      toast.success("Subscription request created.");
    } catch (error) {
      console.error("Failed to create subscription:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create subscription");
    } finally {
      setIsUpgrading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Billing Error</CardTitle>
            <CardDescription>Unable to load your billing information.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const currentPlan = profile.active_subscription_plan;
  const currentPlanForDisplay = currentPlan ?? "spectator";
  const planLimits = PLAN_LIMITS[currentPlanForDisplay];

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and usage</p>
      </div>

      {/* Current Plan Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current Plan
            <Badge variant={currentPlan ? "default" : "secondary"}>
              {currentPlan ? currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1) : "No Active Plan"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-sm text-muted-foreground capitalize">
                {profile.active_subscription_status || "inactive"}
              </p>
            </div>
            {profile.subscription_current_period_end && (
              <div>
                <p className="text-sm font-medium">Renews</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(profile.subscription_current_period_end).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Battle Access</p>
              <p className="text-sm text-muted-foreground">
                {planLimits.battlesPerMonth}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">API Access</p>
              <p className="text-sm text-muted-foreground">
                {planLimits.apiCallsPerMonth}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Upgrade Your Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(["spectator", "pro", "premium"] as const).map((planType) => (
            <SubscriptionCard
              key={planType}
              plan={planType}
              currentPlan={currentPlan}
              onUpgrade={handleUpgrade}
              isLoading={isUpgrading}
            />
          ))}
        </div>
      </div>

      {/* Billing Management */}
      {profile.stripe_customer_id && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Management</CardTitle>
            <CardDescription>Stripe portal wiring still needs to be connected to the canonical billing profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>
              Manage Billing (Stripe Portal)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
