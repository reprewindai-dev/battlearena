import Link from "next/link";

import { CommunityStats } from "@/components/community/CommunityStats";
import { ReferralCard } from "@/components/growth/ReferralCard";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Spitzone Home" };

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
    <div className="space-y-8">
      <section className="spitzone-panel-strong spitzone-metal-line spitzone-surface-grid overflow-hidden px-6 py-7 md:px-8 md:py-9">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr]">
          <div className="space-y-5">
            <div className="spitzone-kicker">Live frequency arena</div>
            <div className="space-y-3">
              <h1 className="spitzone-display spitzone-wordmark text-6xl sm:text-7xl xl:text-8xl">
                Enter the signal
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
                Welcome{user?.email ? `, ${user.email.split("@")[0]}` : ""}. Spitzone is built like a room people stay in:
                live battles, visible regulars, sharp incentives, and a crowd layer that still feels human.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                <div className="spitzone-kicker">Now live</div>
                <div className="mt-2 text-2xl font-semibold text-primary">Battle queues</div>
                <p className="mt-2 text-xs leading-5 text-white/56">Freestyle, ranked, and direct room entry with real session state.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                <div className="spitzone-kicker">Monetize</div>
                <div className="mt-2 text-2xl font-semibold text-white">Tokens + passes</div>
                <p className="mt-2 text-xs leading-5 text-white/56">Premium economy wired into real purchase, access, and event flows.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                <div className="spitzone-kicker">Stay known</div>
                <div className="mt-2 text-2xl font-semibold text-white">Crews + referrals</div>
                <p className="mt-2 text-xs leading-5 text-white/56">Identity, growth loops, and social momentum anchored to your account.</p>
              </div>
            </div>
            <div className="spitzone-wave-divider max-w-xl" />
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full bg-primary px-6 text-sm font-semibold text-black hover:bg-[#ffd071]">
                <Link href="/app/battles">Enter Battle Lobby</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/12 bg-white/4 text-white hover:bg-white/10">
                <Link href="/app/shop">Open Shop</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="rounded-full text-white/72 hover:bg-white/8 hover:text-white">
                <Link href="/app/community">See Community</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,17,25,0.94),rgba(12,12,17,0.98))] p-5">
              <div className="flex items-center justify-between">
                <span className="spitzone-chip-live">Signal stack</span>
                <span className="text-xs uppercase tracking-[0.24em] text-white/44">Prime</span>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-sm text-white/56">Queue temperature</span>
                  <span className="text-sm font-semibold text-white">active</span>
                </div>
                <div className="h-2 rounded-full bg-white/8">
                  <div className="h-full w-[72%] rounded-full bg-[linear-gradient(90deg,#f5d88c_0%,#f3b842_38%,#ff7a1a_74%,#f2447a_100%)]" />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                  <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-4">
                    <div className="text-xl font-semibold text-white">24</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">queued</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-4">
                    <div className="text-xl font-semibold text-primary">9</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">live</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-4">
                    <div className="text-xl font-semibold text-white">3.2k</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">watching</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-black/22 p-5">
              <div className="spitzone-kicker">Mission</div>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Build the room artists, producers, fans, and promoters choose when algorithm platforms stop paying attention.
                The product has to feel like culture with pressure in it, not another utility dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <div>
          <div className="spitzone-kicker">Command layer</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Your next move inside the network</h2>
        </div>
      </div>

      <OnboardingChecklist />

      <ReferralCard />

      <CommunityStats />

      <Separator />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card
              className={`spitzone-panel group h-full p-5 transition-all hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/6 ${
                action.primary ? "border-primary/35 bg-primary/8" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`text-base font-semibold ${action.primary ? "text-primary" : "text-white"}`}>
                    {action.label}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-white/56">{action.description}</div>
                </div>
                <span className="spitzone-chip">
                  {action.tag}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Separator />

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg" className="rounded-full bg-primary px-6 text-sm font-semibold text-black hover:bg-[#ffd071]">
          <Link href="/app/battles">Enter Battle Lobby</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="rounded-full border-white/12 bg-white/4 text-white hover:bg-white/10">
          <Link href="/app/profile">View My Profile</Link>
        </Button>
        <Button asChild size="lg" variant="ghost" className="rounded-full text-white/70 hover:bg-white/8 hover:text-white">
          <Link href="/app/notifications">Notifications</Link>
        </Button>
      </div>
    </div>
  );
}

