import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BattleParticipant = {
  user_id: string;
  slot: number;
  score: number | null;
  handle?: string | null;
  display_name?: string | null;
};

type ParticipantRow = {
  user_id: string;
  slot: number;
  score: number | null;
};

type BattleSession = {
  id: string;
  status: string;
  mode: string;
  created_by?: string | null;
  viewer_user_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  current_round?: number | null;
  voting_opened_at?: string | null;
  voting_closes_at?: string | null;
  result?: unknown | null;
  created_at: string | null;
  can_manage?: boolean;
  viewer_role?: string | null;
  participants: BattleParticipant[];
};

function isModOrAdmin(role: string | null) {
  return role === "mod" || role === "admin";
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const battleId = url.searchParams.get("battleId");
  if (!battleId) {
    return NextResponse.json({ error: "missing_battleId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data: authData } = await supabase.auth.getUser();
  const role =
    (authData?.user?.app_metadata as { role?: string } | undefined)?.role ??
    (authData?.user?.user_metadata as { role?: string } | undefined)?.role ??
    null;

  const { data: battle, error: battleError } = await supabase
    .from("battles")
    .select("*")
    .eq("id", battleId)
    .maybeSingle();

  if (battleError) {
    return NextResponse.json(
      { error: "battle_fetch_failed", details: battleError.message },
      { status: 400 },
    );
  }
  if (!battle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: participants, error: participantsError } = await supabase
    .from("battle_participants")
    .select("user_id,slot,score")
    .eq("battle_id", battleId)
    .order("slot", { ascending: true });

  if (participantsError) {
    return NextResponse.json(
      { error: "participants_fetch_failed", details: participantsError.message },
      { status: 400 },
    );
  }

  const userIds = Array.from(
    new Set(
      (participants ?? [])
        .map((p: ParticipantRow) => p.user_id)
        .filter((id: string | null): id is string => Boolean(id)),
    ),
  );

  const profilesById = new Map<string, { handle: string | null; display_name: string | null }>();
  if (userIds.length > 0) {
    const [{ data: users, error: usersError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase.from("users").select("id,username").in("id", userIds),
      supabase.from("user_profiles").select("user_id,display_name").in("user_id", userIds),
    ]);

    if (!usersError && !profilesError) {
      for (const u of users ?? []) {
        profilesById.set(u.id, { handle: u.username ?? null, display_name: null });
      }
      for (const p of profiles ?? []) {
        if (p.user_id) {
          const existing = profilesById.get(p.user_id);
          profilesById.set(p.user_id, {
            handle: existing?.handle ?? null,
            display_name: (p as { display_name?: string | null }).display_name ?? null,
          });
        }
      }
    }
  }

  const hydratedParticipants: BattleParticipant[] = (participants ?? []).map((p: ParticipantRow) => {
    const prof = profilesById.get(p.user_id);
    return {
      user_id: p.user_id,
      slot: p.slot,
      score: p.score,
      handle: prof?.handle ?? null,
      display_name: prof?.display_name ?? null,
    };
  });

  const session: BattleSession = {
    id: battle.id,
    created_by: battle.created_by,
    status: battle.status,
    mode: battle.mode,
    viewer_user_id: user.id,
    started_at: battle.started_at,
    ended_at: battle.ended_at,
    current_round: (battle as { current_round?: number | null }).current_round ?? null,
    voting_opened_at: (battle as { voting_opened_at?: string | null }).voting_opened_at ?? null,
    voting_closes_at: (battle as { voting_closes_at?: string | null }).voting_closes_at ?? null,
    result: (battle as { result?: unknown | null }).result ?? null,
    created_at: battle.created_at,
    can_manage: battle.created_by === user.id || isModOrAdmin(role),
    viewer_role: role,
    participants: hydratedParticipants,
  };

  return NextResponse.json({ ok: true, mode: "supabase", session });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const username =
    authData.user.email?.split("@")[0] ?? `user_${authData.user.id.slice(0, 8)}`;
  const { error: userError } = await supabase.from("users").upsert(
    {
      id: authData.user.id,
      email: authData.user.email ?? `${username}@battlearena.local`,
      username,
    },
    { onConflict: "id" },
  );

  if (userError) {
    return NextResponse.json(
      { error: "user_sync_failed", details: userError.message },
      { status: 400 },
    );
  }

  const { data: battleRows, error: battleError } = await supabase
    .from("battles")
    .insert({
      created_by: authData.user.id,
      status: "live",
      mode: "freestyle",
      queue_type: "freestyle",
      battle_type: "casual",
      format: "60s",
      battle_format: "60s",
      room_code: `B${Date.now().toString().slice(-9)}`,
    })
    .select("id")
    .limit(1);

  if (battleError || !battleRows?.[0]) {
    return NextResponse.json(
      { error: "battle_create_failed", details: battleError?.message },
      { status: 400 },
    );
  }

  const battleId = battleRows[0].id as string;

  const { error: participantError } = await supabase
    .from("battle_participants")
    .insert({ battle_id: battleId, user_id: authData.user.id, slot: 1 });

  if (participantError) {
    return NextResponse.json(
      { error: "participant_create_failed", details: participantError.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, mode: "supabase", battleId });
}
