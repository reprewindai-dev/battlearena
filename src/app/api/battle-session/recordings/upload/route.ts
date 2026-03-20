import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { loadBattleAccess } from "@/lib/battle/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type UploadInitResponse =
  | {
      ok: true;
      mode: "supabase";
      recordingId: string;
      bucket: string;
      path: string;
      token: string;
      signedUrl: string;
    }
  | { error: string; details?: string };

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

  const access = await loadBattleAccess({ supabase, battleId, userId: authData.user.id, role: "user" });
  if (!access) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!access.isParticipant) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (access.battle.status === "complete" || access.battle.status === "canceled") {
    return NextResponse.json({ error: "battle_not_recordable" }, { status: 409 });
  }

  const bucket = "battle-recordings";
  const fileExt = typeof mimeType === "string" && mimeType.includes("wav") ? "wav" : "webm";
  const path = `${battleId}/${authData.user.id}/${crypto.randomUUID()}.${fileExt}`;

  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (signError || !signed) {
    return NextResponse.json(
      { error: "signed_upload_failed", details: signError?.message },
      { status: 400 },
    );
  }

  const insert: Record<string, unknown> = {
    battle_id: battleId,
    created_by: authData.user.id,
    storage_bucket: bucket,
    storage_path: path,
  };

  if (typeof mimeType === "string") insert.mime_type = mimeType;
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
    insert.duration_seconds = Math.max(0, Math.floor(durationSeconds));
  }
  if (typeof bytes === "number" && Number.isFinite(bytes)) {
    insert.bytes = Math.max(0, Math.floor(bytes));
  }

  const { data: rows, error: insertError } = await supabase
    .from("battle_recordings")
    .insert(insert)
    .select("id")
    .limit(1);

  if (insertError || !rows?.[0]?.id) {
    return NextResponse.json(
      { error: "recording_row_create_failed", details: insertError?.message },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "supabase",
    recordingId: rows[0].id as string,
    bucket,
    path,
    token: signed.token,
    signedUrl: signed.signedUrl,
  } satisfies UploadInitResponse);
}
