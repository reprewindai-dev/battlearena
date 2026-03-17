import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/auth/config";
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

type ParticipantRow = {
  battle_id: string;
  user_id: string;
  slot: number;
};

type ProfileRow = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
};

type HistoryItem = {
  battle: BattleRow;
  opponentLabel: string;
  outcomeLabel: "win" | "loss" | "tie" | "â€”";
};

function safeInt(value: string | null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickOpponentLabel(params: {
  uid: string;
  participants: ParticipantRow[];
  profilesByUserId: Map<string, ProfileRow>;
}) {
  const { uid, participants, profilesByUserId } = params;
  const opp = participants.find((p: any) => p.user_id !== uid);
  if (!opp) return "â€”";
  const prof = profilesByUserId.get(opp.user_id);
  return (
    prof?.handle ??
    prof?.display_name ??
    (opp.user_id.length > 10 ? `${opp.user_id.slice(0, 8)}â€¦` : opp.user_id)
  );
}

function pickOutcomeLabel(params: {
  uid: string;
  participants: ParticipantRow[];
  result: unknown | null | undefined;
}): HistoryItem["outcomeLabel"] {
  const { uid, participants, result } = params;
  const viewer = participants.find((p: any) => p.user_id === uid);
  if (!viewer) return "â€”";

  const winnerSlot =
    result && typeof result === "object" && "winner_slot" in result
      ? (result as { winner_slot?: unknown }).winner_slot
      : null;
  const winner = typeof winnerSlot === "number" ? winnerSlot : null;

  if (!winner || winner === 0) return "tie";
  return viewer.slot === winner ? "win" : "loss";
}

function uniqueById(rows: BattleRow[]) {
  const map = new Map<string, BattleRow>();
  for (const r of rows) map.set(r.id, r);
  return Array.from(map.values());
}

export default async function BattleHistoryPage(props: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const searchParams = props.searchParams ?? {};
  const statusParam = typeof searchParams["status"] === "string" ? searchParams["status"] : null;
  const modeParam = typeof searchParams["mode"] === "string" ? searchParams["mode"] : null;
  const pageParam = typeof searchParams["page"] === "string" ? searchParams["page"] : null;
  const page = Math.max(1, safeInt(pageParam) ?? 1);
  const pageSize = 20;

  function hrefWith(next: { status?: string | null; mode?: string | null; page?: number }) {
    const params = new URLSearchParams();
    const s = next.status ?? statusParam;
    const m = next.mode ?? modeParam;
    const p = next.page ?? page;
    if (s) params.set("status", s);
    if (m) params.set("mode", m);
    if (p && p !== 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/app/battles/history?${qs}` : "/app/battles/history";
  }

  async function getHistory(): Promise<{ items: HistoryItem[]; total: number }> {
    if (!isSupabaseConfigured) {
      return { items: [], total: 0 }; // Supabase not configured
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { items: [], total: 0 }; // Handle null return

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return { items: [], total: 0 };

    const { data: createdByMe } = await supabase
      .from("battles")
      .select("id,status,mode,created_at,ended_at,created_by,result")
      .eq("created_by", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data: participantJoinRows } = await supabase
      .from("battle_participants")
      .select(
        "battle_id,battles!inner(id,status,mode,created_at,ended_at,created_by,result)",
      )
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    const participated = (participantJoinRows ?? [])
      .flatMap((r: any) => {
        const joined = (r as { battles?: unknown }).battles;
        if (!joined) return [];
        if (Array.isArray(joined)) return joined as BattleRow[];
        return [joined as BattleRow];
      })
      .filter((b: unknown): b is BattleRow => Boolean(b));

    const merged = uniqueById([...(createdByMe ?? []), ...participated]);

    const filtered = merged
      .filter((b: any) => b.status === "complete" || b.status === "canceled")
      .filter((b: any) => (statusParam ? b.status === statusParam : true))
      .filter((b: any) => (modeParam ? b.mode === modeParam : true))
      .sort((a: BattleRow, b: BattleRow) => {
        const ta = new Date(a.created_at ?? 0).getTime();
        const tb = new Date(b.created_at ?? 0).getTime();
        return tb - ta;
      });

    const total = filtered.length;
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
    const battleIds = slice.map((b: any) => b.id);

    const { data: participants } = await supabase
      .from("battle_participants")
      .select("battle_id,user_id,slot")
      .in("battle_id", battleIds);

    const participantRows: ParticipantRow[] = ((participants ?? []) as ParticipantRow[]) ?? [];
    const userIds = Array.from(new Set(participantRows.map((p: any) => p.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id,handle,display_name")
      .in("user_id", userIds);

    const profilesByUserId = new Map<string, ProfileRow>();
    for (const p of (profiles ?? []) as ProfileRow[]) {
      profilesByUserId.set(p.user_id, p);
    }

    const participantsByBattleId = new Map<string, ParticipantRow[]>();
    for (const p of participantRows) {
      const arr = participantsByBattleId.get(p.battle_id) ?? [];
      arr.push(p);
      participantsByBattleId.set(p.battle_id, arr);
    }

    const items: HistoryItem[] = slice.map((battle: any) => {
      const parts = participantsByBattleId.get(battle.id) ?? [];
      return {
        battle,
        opponentLabel: pickOpponentLabel({ uid, participants: parts, profilesByUserId }),
        outcomeLabel: pickOutcomeLabel({ uid, participants: parts, result: battle.result }),
      };
    });

    return { items, total };
  }

  const history = await getHistory();
  const totalPages = Math.max(1, Math.ceil(history.total / pageSize));
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

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
              {!isSupabaseConfigured
                ? "Supabase not configured"
                : "Supabase-backed history"}
            </div>
          </div>
          <Badge variant="secondary">history</Badge>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">status</Badge>
          <Button asChild size="sm" variant={statusParam ? "outline" : "default"}>
            <Link href={hrefWith({ status: null, page: 1 })}>All</Link>
          </Button>
          <Button asChild size="sm" variant={statusParam === "complete" ? "default" : "outline"}>
            <Link href={hrefWith({ status: "complete", page: 1 })}>Complete</Link>
          </Button>
          <Button asChild size="sm" variant={statusParam === "canceled" ? "default" : "outline"}>
            <Link href={hrefWith({ status: "canceled", page: 1 })}>Canceled</Link>
          </Button>
          <div className="mx-2 h-4 w-px bg-border/60" />
          <Badge variant="secondary">mode</Badge>
          <Button asChild size="sm" variant={modeParam ? "outline" : "default"}>
            <Link href={hrefWith({ mode: null, page: 1 })}>All</Link>
          </Button>
          <Button asChild size="sm" variant={modeParam === "freestyle" ? "default" : "outline"}>
            <Link href={hrefWith({ mode: "freestyle", page: 1 })}>Freestyle</Link>
          </Button>
          <Button asChild size="sm" variant={modeParam === "ranked" ? "default" : "outline"}>
            <Link href={hrefWith({ mode: "ranked", page: 1 })}>Ranked</Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          {history.items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No completed battles yet.</div>
          ) : (
            history.items.map((item: any) => (
              <div
                key={item.battle.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/20 px-4 py-3"
              >
                <div className="min-w-[240px]">
                  <div className="font-mono text-sm text-foreground">{item.battle.id}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.battle.mode} Â· {item.battle.status}
                    {item.battle.created_at
                      ? ` Â· ${new Date(item.battle.created_at).toLocaleString()}`
                      : ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Opponent: {item.opponentLabel}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={item.battle.status === "complete" ? "default" : "secondary"}>
                    {item.outcomeLabel}
                  </Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/app/battles/room?battleId=${encodeURIComponent(item.battle.id)}`}
                    >
                      View
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Page {page} of {totalPages} Â· {history.total} total
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" disabled={page <= 1}>
              <Link href={hrefWith({ page: prevPage })}>Prev</Link>
            </Button>
            <Button asChild size="sm" variant="outline" disabled={page >= totalPages}>
              <Link href={hrefWith({ page: nextPage })}>Next</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

