import { NextResponse } from "next/server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

type BattleRow = {
  id: string;
  status: string;
  mode: string | null;
  created_at: string | null;
  battle_format: string | null;
};

type ParticipantRow = {
  battle_id: string;
  slot: number | null;
};

function toBattleType(mode: string | null): "ranked" | "casual" | "tournament" {
  if (mode === "ranked") return "ranked";
  if (mode === "tournament") return "tournament";
  return "casual";
}

function toFormat(value: string | null): "30s" | "60s" | "90s" {
  if (value === "30s" || value === "60s" || value === "90s") {
    return value;
  }
  return "60s";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? "12");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.floor(limitRaw))) : 12;

    const adminClient = createSupabaseServiceRoleClient();

    const { data: battles, error: battlesError } = await adminClient
      .from("battles")
      .select("id,status,mode,created_at,battle_format")
      .in("status", ["queued", "live"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (battlesError) {
      return NextResponse.json({ error: "battles_fetch_failed", details: battlesError.message }, { status: 500 });
    }

    const battleIds = (battles ?? []).map((battle) => battle.id);

    let participantCounts = new Map<string, number>();
    if (battleIds.length > 0) {
      const { data: participants, error: participantsError } = await adminClient
        .from("battle_participants")
        .select("battle_id,slot")
        .in("battle_id", battleIds);

      if (participantsError) {
        return NextResponse.json(
          { error: "battle_participants_fetch_failed", details: participantsError.message },
          { status: 500 },
        );
      }

      participantCounts = (participants ?? []).reduce((acc, row) => {
        const typed = row as ParticipantRow;
        acc.set(typed.battle_id, (acc.get(typed.battle_id) ?? 0) + 1);
        return acc;
      }, new Map<string, number>());
    }

    const cards = (battles ?? []).map((row) => {
      const battle = row as BattleRow;
      const currentParticipants = participantCounts.get(battle.id) ?? 0;

      return {
        id: battle.id,
        title: `Battle ${battle.id.slice(0, 6).toUpperCase()}`,
        room_code: battle.id.slice(0, 6).toUpperCase(),
        battle_type: toBattleType(battle.mode),
        format: toFormat(battle.battle_format),
        entry_fee_tokens: 0,
        status: battle.status === "live" ? "active" : "waiting",
        current_participants: currentParticipants,
        max_participants: 2,
        viewers: 0,
      };
    });

    return NextResponse.json({ ok: true, battles: cards });
  } catch (error) {
    return NextResponse.json(
      {
        error: "battles_list_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
