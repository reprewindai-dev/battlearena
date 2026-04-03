import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { canViewBattle, loadBattleAccess, type SessionRole } from "@/lib/battle/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ApiMessage = {
  id: string;
  author: string;
  body: string;
  ts: number;
};

function parseSessionRole(rawRole: string | null): SessionRole {
  return rawRole === "admin" || rawRole === "mod" || rawRole === "user" ? rawRole : null;
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

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawRole =
    (authData.user.app_metadata as { role?: string } | undefined)?.role ??
    (authData.user.user_metadata as { role?: string } | undefined)?.role ??
    null;
  const role = parseSessionRole(rawRole);

  let access;
  try {
    access = await loadBattleAccess({
      supabase,
      battleId,
      userId: authData.user.id,
      role,
      select: "id,created_by,status",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "battle_access_failed", details: error instanceof Error ? error.message : "unknown" },
      { status: 400 },
    );
  }

  if (!access) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (
    !canViewBattle({
      battle: access.battle,
      userId: authData.user.id,
      isParticipant: access.isParticipant,
      canModerate: access.canModerate,
    })
  ) {
    return NextResponse.json({ error: "not_participant" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("battle_messages")
    .select("id,created_by,body,created_at")
    .eq("battle_id", battleId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "messages_fetch_failed", details: error.message }, { status: 400 });
  }

  const userIds = Array.from(
    new Set(
      (rows ?? [])
        .map((r: { created_by: string | null }) => r.created_by)
        .filter((id: string | null): id is string => Boolean(id)),
    ),
  );

  const profilesById = new Map<string, { handle: string | null; display_name: string | null }>();
  if (userIds.length > 0) {
    const [{ data: users, error: usersError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase.from("users").select("id,username").in("id", userIds),
      supabase.from("user_profiles").select("user_id,display_name").in("user_id", userIds),
    ]);

    if (usersError || profilesError) {
      return NextResponse.json(
        { error: "profiles_fetch_failed", details: usersError?.message ?? profilesError?.message ?? "unknown" },
        { status: 400 },
      );
    }

    for (const u of users ?? []) {
      profilesById.set(u.id, {
        handle: u.username ?? null,
        display_name: null,
      });
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

  const messages: ApiMessage[] = (rows ?? []).map((r: any) => {
    const prof = profilesById.get(r.created_by);
    const author = prof?.display_name ?? prof?.handle ?? r.created_by.slice(0, 8);
    const ts = r.created_at ? Date.parse(r.created_at) : Date.now();
    return { id: r.id, author, body: r.body, ts };
  });

  return NextResponse.json({ ok: true, mode: "supabase", messages });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const battleId =
    body && typeof body === "object" && "battleId" in body
      ? ((body as Record<string, unknown>).battleId as unknown)
      : null;
  const messageBody =
    body && typeof body === "object" && "body" in body
      ? ((body as Record<string, unknown>).body as unknown)
      : null;

  if (typeof battleId !== "string" || battleId.length === 0) {
    return NextResponse.json({ error: "missing_battleId" }, { status: 400 });
  }
  if (typeof messageBody !== "string" || messageBody.trim().length === 0) {
    return NextResponse.json({ error: "missing_body" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawRole =
    (authData.user.app_metadata as { role?: string } | undefined)?.role ??
    (authData.user.user_metadata as { role?: string } | undefined)?.role ??
    null;
  const role = parseSessionRole(rawRole);

  let access;
  try {
    access = await loadBattleAccess({
      supabase,
      battleId,
      userId: authData.user.id,
      role,
      select: "id,created_by,status",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "battle_access_failed", details: error instanceof Error ? error.message : "unknown" },
      { status: 400 },
    );
  }

  if (!access) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (
    !canViewBattle({
      battle: access.battle,
      userId: authData.user.id,
      isParticipant: access.isParticipant,
      canModerate: access.canModerate,
    })
  ) {
    return NextResponse.json({ error: "not_participant" }, { status: 403 });
  }

  const { error } = await supabase.from("battle_messages").insert({
    battle_id: battleId,
    created_by: authData.user.id,
    body: messageBody.trim(),
  });

  if (error) {
    return NextResponse.json({ error: "message_create_failed", details: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, mode: "supabase" });
}
