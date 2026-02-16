import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isMockAuthEnabled, isSupabaseConfigured } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BattleRow = {
  id: string;
  status: "draft" | "queued" | "live" | "complete" | "canceled";
  mode: string;
  created_at: string | null;
  ended_at: string | null;
  created_by?: string | null;
  result?: unknown | null;
};

function uniqueById(rows: BattleRow[]) {
  const map = new Map<string, BattleRow>();
  for (const r of rows) map.set(r.id, r);
  return Array.from(map.values());
}

export default async function BattleHistoryPage() {
  async function getHistory(): Promise<BattleRow[]> {
    if (!isSupabaseConfigured || isMockAuthEnabled) {
      return [
        {
          id: "mock_history_01",
          status: "complete",
          mode: "freestyle",
          created_at: null,
          ended_at: null,
          created_by: "mock-user-a",
          result: { winner_slot: 1, votes: { slot1: 5, slot2: 2 } },
        },
        {
          id: "mock_history_02",
          status: "complete",
          mode: "freestyle",
          created_at: null,
          ended_at: null,
          created_by: "mock-user-b",
          result: { winner_slot: 2, votes: { slot1: 3, slot2: 4 } },
        },
      ];
    }

    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return [];

    const { data: createdByMe } = await supabase
      .from("battles")
      .select("id,status,mode,created_at,ended_at,created_by,result")
      .eq("created_by", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: participantRows } = await supabase
      .from("battle_participants")
      .select(
        "battle_id,battles!inner(id,status,mode,created_at,ended_at,created_by,result)",
      )
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    const participated = (participantRows ?? [])
      .flatMap((r) => {
        const joined = (r as { battles?: unknown }).battles;
        if (!joined) return [];
        if (Array.isArray(joined)) return joined as BattleRow[];
        return [joined as BattleRow];
      })
      .filter((b): b is BattleRow => Boolean(b));

    const merged = uniqueById([...(createdByMe ?? []), ...participated])
      .filter((b) => b.status === "complete" || b.status === "canceled")
      .sort((a, b) => {
        const ta = new Date(a.created_at ?? 0).getTime();
        const tb = new Date(b.created_at ?? 0).getTime();
        return tb - ta;
      });

    return merged;
  }

  const battles = await getHistory();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Battle History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Completed battles you created or participated in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/app/battles">Back to lobby</Link>
          </Button>
          <Button asChild>
            <Link href="/app/battles/room">Enter battle room</Link>
          </Button>
        </div>
      </div>

      <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Past battles</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {isMockAuthEnabled || !isSupabaseConfigured
                ? "Mock list (Supabase not configured)"
                : "Supabase-backed history"}
            </div>
          </div>
          <Badge variant="secondary">history</Badge>
        </div>

        <div className="mt-4 grid gap-3">
          {battles.length === 0 ? (
            <div className="text-sm text-muted-foreground">No completed battles yet.</div>
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

                <div className="flex items-center gap-2">
                  <Badge variant={b.status === "complete" ? "default" : "secondary"}>
                    {b.result ? "result" : "no result"}
                  </Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/battles/room?battleId=${encodeURIComponent(b.id)}`}>
                      View
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
