"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { PLANS, type PlanType } from "@/lib/billing/stripe";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type UserProfile = {
  subscription_tier: PlanType;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  battles_used_this_month: number;
  api_usage_count: number;
  stripe_customer_id: string | null;
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
          .from("profiles")
          .select("subscription_tier, subscription_status, subscription_ends_at, battles_used_this_month, api_usage_count, stripe_customer_id")
          .eq("user_id", user.id)
          .single();

        setProfile(profile);
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [supabase]);

  async function handleUpgrade(plan: PlanType) {
    setIsUpgrading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ planType: plan }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error);
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

  const currentPlan = profile.subscription_tier;
  const planLimits = PLANS[currentPlan].limits;

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
            <Badge variant={currentPlan === "free" ? "secondary" : "default"}>
              {PLANS[currentPlan].name}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-sm text-muted-foreground capitalize">
                {profile.subscription_status || "Active"}
              </p>
            </div>
            {profile.subscription_ends_at && (
              <div>
                <p className="text-sm font-medium">Renews</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(profile.subscription_ends_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Battles This Month</p>
              <p className="text-sm text-muted-foreground">
                {profile.battles_used_this_month}
                {planLimits.battlesPerMonth > 0 ? ` / ${planLimits.battlesPerMonth}` : " (Unlimited)"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">API Calls This Month</p>
              <p className="text-sm text-muted-foreground">
                {profile.api_usage_count}
                {planLimits.apiCallsPerMonth > 0 ? ` / ${planLimits.apiCallsPerMonth}` : " (Unlimited)"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Upgrade Your Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(PLANS).map(([planType]) => (
            <SubscriptionCard
              key={planType}
              plan={planType as PlanType}
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
            <CardDescription>Manage your payment methods and billing history</CardDescription>
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
