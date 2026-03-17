import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FreestyleQueueCard } from "@/components/battle/FreestyleQueueCard";
import { RankedQueueCard } from "@/components/battle/RankedQueueCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Battle Lobby – Battle Arena" };

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

  return (data || []) as Array<{
    id: string;
    status: "draft" | "queued" | "live" | "complete" | "canceled";
    mode: string;
    created_at: string | null;
  }>;
}

export default function BattleLobbyPage() {
  async function getRecentBattles() {
    const supabase = await createSupabaseServerClient();
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

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Battle Lobby</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join a queue or enter a battle room.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/app/battles/history">History</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/app/rooms">Browse Rooms</Link>
          </Button>
          <Button asChild>
            <Link href="/app/battles/room">Live Battles</Link>
          </Button>
          <Button asChild>
            <Link href="/app/battles/room">Enter Battle Room</Link>
          </Button>
        </div>
      </div>

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
    <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Recent Sessions</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Your latest battles (created by you)
          </div>
        </div>
        <Badge variant="secondary">live</Badge>
      </div>

      <div className="mt-4 grid gap-3">
        {battles.length === 0 ? (
          <div className="text-sm text-muted-foreground">No sessions yet. Join a queue below to get started.</div>
        ) : (
          battles.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/20 px-4 py-3"
            >
              <div className="min-w-[240px]">
                <div className="font-mono text-sm text-foreground">{b.id}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {b.mode} · {b.status}
                  {b.created_at ? ` · ${new Date(b.created_at).toLocaleString()}` : ""}
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/app/battles/room?battleId=${encodeURIComponent(b.id)}`}>
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
