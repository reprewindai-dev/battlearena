import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isMockAuthEnabled, isSupabaseConfigured } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default function BattleLobbyPage() {
  async function getRecentBattles() {
    if (!isSupabaseConfigured || isMockAuthEnabled) {
      return [
        { id: "mock_ionrunner_01", status: "live" as const, mode: "freestyle", created_at: null as string | null },
        { id: "mock_glasscity_02", status: "queued" as const, mode: "freestyle", created_at: null as string | null },
        { id: "mock_neondrift_03", status: "complete" as const, mode: "freestyle", created_at: null as string | null },
      ];
    }

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
            Recent sessions + queues (incremental).
          </p>
        </div>
        <Button asChild>
          <Link href="/app/battles/room">Enter battle room</Link>
        </Button>
      </div>

      <RecentBattles getRecentBattles={getRecentBattles} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Freestyle queue</div>
            <Badge variant="secondary">stub</Badge>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            In v1 this will create a battle record and add you as a participant.
          </div>
        </Card>

        <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Ranked queue</div>
            <Badge variant="secondary">stub</Badge>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Ratings (Glicko placeholders) will back matchmaking.
          </div>
        </Card>
      </div>
    </div>
  );
}

async function RecentBattles({
  getRecentBattles,
}: {
  getRecentBattles: () => Promise<
    Array<{ id: string; status: string; mode: string; created_at: string | null }>
  >;
}) {
  const battles = await getRecentBattles();

  return (
    <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Recent sessions</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {isMockAuthEnabled || !isSupabaseConfigured
              ? "Mock list (Supabase not configured)"
              : "Your latest battles (created by you)"}
          </div>
        </div>
        <Badge variant="secondary">live</Badge>
      </div>

      <div className="mt-4 grid gap-3">
        {battles.length === 0 ? (
          <div className="text-sm text-muted-foreground">No sessions yet.</div>
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
