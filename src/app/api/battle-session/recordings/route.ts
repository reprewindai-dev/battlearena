import { NextResponse } from "next/server";

import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import { loadBattleAccess } from "@/lib/battle/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RecordingMeta = {
  id: string;
  created_by: string;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  duration_seconds: number | null;
  bytes: number | null;
  note: string | null;
  uploaded_at: string | null;
  created_at: string;
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
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const role = await getSessionRole();
  const access = await loadBattleAccess({ supabase, battleId, userId: user.id, role });
  if (!access) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!access.isParticipant && !access.canModerate) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("battle_recordings")
    .select(
      "id,created_by,storage_bucket,storage_path,mime_type,duration_seconds,bytes,note,uploaded_at,created_at",
    )
    .eq("battle_id", battleId)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "recordings_fetch_failed", details: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, mode: "supabase", recordings: (rows ?? []) as RecordingMeta[] });
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
  const mimeType =
    body && typeof body === "object" && "mimeType" in body
      ? ((body as Record<string, unknown>).mimeType as unknown)
      : null;
  const durationSeconds =
    body && typeof body === "object" && "durationSeconds" in body
      ? ((body as Record<string, unknown>).durationSeconds as unknown)
      : null;
  const bytes =
    body && typeof body === "object" && "bytes" in body
      ? ((body as Record<string, unknown>).bytes as unknown)
      : null;
  const note =
    body && typeof body === "object" && "note" in body
      ? ((body as Record<string, unknown>).note as unknown)
      : null;

  if (typeof battleId !== "string" || battleId.length === 0) {
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

  const role = await getSessionRole();
  const access = await loadBattleAccess({ supabase, battleId, userId: authData.user.id, role });
  if (!access) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!access.isParticipant) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (access.battle.status === "canceled") {
    return NextResponse.json({ error: "battle_not_recordable" }, { status: 409 });
  }

  const insert: Record<string, unknown> = {
    battle_id: battleId,
    created_by: authData.user.id,
  };

  if (typeof mimeType === "string") insert.mime_type = mimeType;
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
    insert.duration_seconds = Math.max(0, Math.floor(durationSeconds));
  }
  if (typeof bytes === "number" && Number.isFinite(bytes)) {
    insert.bytes = Math.max(0, Math.floor(bytes));
  }
  if (typeof note === "string") insert.note = note;

  const { error } = await supabase.from("battle_recordings").insert(insert);

  if (error) {
    return NextResponse.json(
      { error: "recording_meta_create_failed", details: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, mode: "supabase" });
}
