import Link from "next/link";

import { CommunityStats } from "@/components/community/CommunityStats";
import { ReferralCard } from "@/components/growth/ReferralCard";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Battle Arena Home" };

const QUICK_ACTIONS = [
  { href: "/app/battles", label: "Find a Battle", description: "Join a live queue or create a room.", tag: "LIVE", primary: true },
  { href: "/app/community", label: "Community Feed", description: "See what crews, battlers, and fans are doing.", tag: "FEED", primary: false },
  { href: "/app/leaderboard", label: "Leaderboard", description: "Track the battlers climbing the ladder.", tag: "RANK", primary: false },
  { href: "/app/tournaments", label: "Tournaments", description: "Register for upcoming events and brackets.", tag: "EVENT", primary: false },
  { href: "/app/shop", label: "Shop", description: "Manage tokens, access, and premium purchases.", tag: "SHOP", primary: false },
  { href: "/app/challenges", label: "Challenges", description: "Send and accept direct callouts.", tag: "PVP", primary: false },
];

export default async function AppHomePage() {
  const user = await getSessionUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          Welcome{user?.email ? `, ${user.email.split("@")[0]}` : ""}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Battle Arena is live. Queue up, battle, and hold your place on the board.
        </p>
      </div>

      <OnboardingChecklist />

      <ReferralCard />

      <CommunityStats />

      <Separator />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card
              className={`group h-full border-border/60 bg-card/30 p-5 backdrop-blur transition-all hover:bg-card/60 hover:shadow-md ${
                action.primary ? "border-primary/40 bg-primary/5 hover:bg-primary/10" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`font-semibold ${action.primary ? "text-primary" : ""}`}>
                    {action.label}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{action.description}</div>
                </div>
                <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                  {action.tag}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Separator />

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/app/battles">Enter Battle Lobby</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/app/profile">View My Profile</Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href="/app/notifications">Notifications</Link>
        </Button>
      </div>
    </div>
  );
}

