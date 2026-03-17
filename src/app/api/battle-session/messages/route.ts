import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ApiMessage = {
  id: string;
  author: string;
  body: string;
  ts: number;
};

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
    new Set((rows ?? []).map((r) => r.created_by).filter((id): id is string => Boolean(id))),
  );

  const profilesById = new Map<string, { handle: string | null; display_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id,handle,display_name")
      .in("user_id", userIds);

    if (profilesError) {
      return NextResponse.json(
        { error: "profiles_fetch_failed", details: profilesError.message },
        { status: 400 },
      );
    }

    for (const p of profiles ?? []) {
      if (p.user_id) {
        profilesById.set(p.user_id, {
          handle: (p as { handle?: string | null }).handle ?? null,
          display_name: (p as { display_name?: string | null }).display_name ?? null,
        });
      }
    }
  }

  const messages: ApiMessage[] = (rows ?? []).map((r) => {
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
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
