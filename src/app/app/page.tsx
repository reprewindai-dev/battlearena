import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { CommunityStats } from "@/components/community/CommunityStats";

export const metadata = { title: "Battle Arena – Home" };

const QUICK_ACTIONS = [
  { href: "/app/battles", label: "Find a Battle", description: "Join or create a battle now", icon: "⚔️", primary: true },
  { href: "/app/community", label: "Community Feed", description: "See what's happening", icon: "🌐", primary: false },
  { href: "/app/leaderboard", label: "Leaderboard", description: "See who's dominating", icon: "🏆", primary: false },
  { href: "/app/tournaments", label: "Tournaments", description: "Register and compete", icon: "🎯", primary: false },
  { href: "/app/shop", label: "Shop", description: "Get tokens & subscriptions", icon: "💎", primary: false },
  { href: "/app/challenges", label: "Challenges", description: "Accept or send challenges", icon: "⚡", primary: false },
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
          The Arena is live. Battle, rank up, and claim your spot.
        </p>
      </div>

      <CommunityStats />

      <Separator />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map(action => (
          <Link key={action.href} href={action.href}>
            <Card className={`group h-full border-border/60 bg-card/30 p-5 backdrop-blur transition-all hover:bg-card/60 hover:shadow-md ${action.primary ? "border-primary/40 bg-primary/5 hover:bg-primary/10" : ""}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{action.icon}</span>
                <div>
                  <div className={`font-semibold ${action.primary ? "text-primary" : ""}`}>
                    {action.label}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{action.description}</div>
                </div>
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
