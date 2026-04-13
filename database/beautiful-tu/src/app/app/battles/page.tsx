import Link from "next/link";

import { FreestyleQueueCard } from "@/components/battle/FreestyleQueueCard";
import { RankedQueueCard } from "@/components/battle/RankedQueueCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Battle Lobby - Spitzone" };

async function getRecentBattles() {
  "use server";

  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const { data } = await supabase
    .from("battles")
    .select("id,status,mode,created_at")
    .eq("created_by", uid)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data ?? []) as Array<{
    id: string;
    status: "draft" | "queued" | "live" | "complete" | "canceled";
    mode: string;
    created_at: string | null;
  }>;
}

export default function BattleLobbyPage() {
  return (
    <div className="space-y-8">
      <section className="spitzone-panel-strong spitzone-metal-line spitzone-surface-grid overflow-hidden px-6 py-7 md:px-8 md:py-9">
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.75fr]">
          <div className="space-y-5">
            <div className="spitzone-kicker">Battle frequency</div>
            <div className="space-y-3">
              <h1 className="spitzone-display spitzone-wordmark text-5xl sm:text-6xl xl:text-7xl">
                Control the room
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
                Enter human match flow fast. Casual queue keeps the room warm. Ranked queue carries pressure, badge
                value, and ladder movement. Direct rooms stay ready when you want to bypass the line and go live now.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                <div className="spitzone-kicker">Casual</div>
                <div className="mt-2 text-2xl font-semibold text-primary">Freestyle</div>
                <p className="mt-2 text-xs leading-5 text-white/56">
                  Free entry, quick room creation, and bot fallback to keep momentum up.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                <div className="spitzone-kicker">Competitive</div>
                <div className="mt-2 text-2xl font-semibold text-white">Ranked ladder</div>
                <p className="mt-2 text-xs leading-5 text-white/56">
                  Real stakes, tier movement, and queue discipline built for repeat battlers.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                <div className="spitzone-kicker">Direct access</div>
                <div className="mt-2 text-2xl font-semibold text-white">Live rooms</div>
                <p className="mt-2 text-xs leading-5 text-white/56">
                  Jump straight into an active room, spectate, or run a private battle on demand.
                </p>
              </div>
            </div>
            <div className="spitzone-wave-divider max-w-xl" />
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-primary px-6 text-sm font-semibold text-black hover:bg-[#ffd071]"
              >
                <Link href="/app/battles/room">Enter Live Room</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-white/12 bg-white/4 text-white hover:bg-white/10"
              >
                <Link href="/app/rooms">Browse Rooms</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="rounded-full text-white/72 hover:bg-white/8 hover:text-white"
              >
                <Link href="/app/battles/history">Open History</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,17,25,0.94),rgba(12,12,17,0.98))] p-5">
              <div className="flex items-center justify-between">
                <span className="spitzone-chip-live">Queue signal</span>
                <span className="text-xs uppercase tracking-[0.24em] text-white/44">Prime</span>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-sm text-white/56">Match pressure</span>
                  <span className="text-sm font-semibold text-white">rising</span>
                </div>
                <div className="h-2 rounded-full bg-white/8">
                  <div className="h-full w-[78%] rounded-full bg-[linear-gradient(90deg,#f5d88c_0%,#f3b842_38%,#ff7a1a_74%,#f2447a_100%)]" />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                  <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-4">
                    <div className="text-xl font-semibold text-white">2</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">queues</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-4">
                    <div className="text-xl font-semibold text-primary">60s</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">rounds</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-4">
                    <div className="text-xl font-semibold text-white">live</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/44">rooms ready</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-black/22 p-5">
              <div className="spitzone-kicker">Room law</div>
              <p className="mt-3 text-sm leading-6 text-white/62">
                Good battle UX is fast entry, clear stakes, and no dead air. The lobby should feel like a real venue,
                not a queue form.
              </p>
            </div>
          </div>
        </div>
      </section>

      <RecentBattles />

      <div className="grid gap-4 md:grid-cols-2">
        <FreestyleQueueCard />
        <RankedQueueCard />
      </div>
    </div>
  );
}

async function RecentBattles() {
  const battles = await getRecentBattles();

  return (
    <Card className="spitzone-panel p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="spitzone-kicker">Recent sessions</div>
          <div className="mt-2 text-sm leading-6 text-white/58">
            Your latest battle rooms launched from this account.
          </div>
        </div>
        <Badge className="spitzone-chip-live border-0 bg-transparent px-0 py-0 text-[10px] shadow-none">
          room log
        </Badge>
      </div>

      <div className="mt-4 grid gap-3">
        {battles.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-white/56">
            No sessions yet. Join a queue below and the next room you create will show up here.
          </div>
        ) : (
          battles.map((battle) => (
            <div
              key={battle.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-4"
            >
              <div className="min-w-[240px]">
                <div className="font-mono text-sm text-white">{battle.id}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/42">
                  {battle.mode} · {battle.status}
                </div>
                <div className="mt-2 text-xs text-white/52">
                  {battle.created_at ? new Date(battle.created_at).toLocaleString() : "creation time unavailable"}
                </div>
              </div>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="rounded-full border-white/12 bg-white/4 text-white hover:bg-white/10"
              >
                <Link href={`/app/battles/room?battleId=${encodeURIComponent(battle.id)}`}>
                  Enter
                </Link>
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

