import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(60%_50%_at_50%_0%,oklch(0.78_0.09_275_/_0.16),transparent_70%),radial-gradient(40%_35%_at_0%_30%,oklch(0.72_0.12_200_/_0.10),transparent_60%),radial-gradient(35%_35%_at_100%_60%,oklch(0.8_0.12_320_/_0.10),transparent_60%)]" />
      <main className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="flex items-center justify-between">
          <div className="text-sm font-medium tracking-wide text-muted-foreground">
            ARENA
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              Cinematic battles.
              <span className="text-primary"> Real community.</span>
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Foundation build: auth, RBAC, moderation, economy ledger, and battle
              skeletons — wired end-to-end with safe defaults so it runs locally
              immediately.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/app">Enter app</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/app/battles">Battle lobby</Link>
              </Button>
            </div>
          </div>

          <div className="md:col-span-5">
            <Card className="border-border/60 bg-card/40 p-6 backdrop-blur">
              <div className="text-sm font-medium">Tonight’s build</div>
              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                <div>Auth + session model (Supabase, mock fallback)</div>
                <div>RBAC-gated routes (admin/mod)</div>
                <div>Battle room skeleton + moderation console</div>
              </div>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
