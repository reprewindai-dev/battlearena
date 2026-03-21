"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  complete: boolean;
};

type OnboardingState = {
  dismissed: boolean;
  completed: boolean;
  completedSteps: number;
  totalSteps: number;
  steps: OnboardingStep[];
};

export function OnboardingChecklist() {
  const [state, setState] = React.useState<OnboardingState | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch("/api/onboarding", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { onboarding?: OnboardingState };
        if (!cancelled) {
          setState(body.onboarding ?? null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateState = async (action: "dismiss" | "reopen" | "view") => {
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { onboarding?: OnboardingState };
    setState(body.onboarding ?? null);
  };

  React.useEffect(() => {
    if (state && !state.dismissed && !state.completed) {
      void updateState("view");
    }
  }, [Boolean(state)]);

  if (loading || !state || state.completed || state.dismissed) {
    return null;
  }

  const progress = state.totalSteps > 0 ? (state.completedSteps / state.totalSteps) * 100 : 0;
  const nextStep = state.steps.find((step) => !step.complete) ?? state.steps[0];

  return (
    <Card className="border-primary/40 bg-primary/5 p-5 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">Onboarding</div>
            <h2 className="mt-1 text-xl font-bold text-foreground">Activate your Battle Arena account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete the real production checklist so battles, monetization, and community loops are live on your account.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>{state.completedSteps} of {state.totalSteps} complete</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {state.steps.map((step) => (
              <Link
                key={step.id}
                href={step.href}
                className={`rounded-xl border p-3 transition-colors ${step.complete ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/70 bg-background/50 hover:border-primary/50 hover:bg-background/80"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{step.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{step.description}</div>
                  </div>
                  <div className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${step.complete ? "bg-emerald-500/20 text-emerald-300" : "bg-primary/15 text-primary"}`}>
                    {step.complete ? "Done" : "Open"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Button asChild>
            <Link href={nextStep.href}>{nextStep.complete ? "Open checklist" : `Start: ${nextStep.title}`}</Link>
          </Button>
          <Button variant="ghost" onClick={() => void updateState("dismiss")}>
            Dismiss for now
          </Button>
        </div>
      </div>
    </Card>
  );
}
