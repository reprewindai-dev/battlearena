import { NextResponse } from "next/server";

import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const role = await getSessionRole();
  if (role !== "admin" && role !== "mod") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const recordingId =
    body && typeof body === "object" && "recordingId" in body
      ? ((body as Record<string, unknown>).recordingId as unknown)
      : null;

  if (typeof recordingId !== "string" || recordingId.length === 0) {
    return NextResponse.json({ error: "missing_recordingId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data: row, error: fetchError } = await supabase
    .from("battle_recordings")
    .select("id,storage_bucket,storage_path")
    .eq("id", recordingId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: "recording_fetch_failed", details: fetchError.message },
      { status: 400 },
    );
  }

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (row.storage_bucket && row.storage_path) {
    try {
      await supabase.storage.from(row.storage_bucket).remove([row.storage_path]);
    } catch {
      // best-effort
    }
  }

  const { error: deleteError } = await supabase.from("battle_recordings").delete().eq("id", recordingId);
  if (deleteError) {
    return NextResponse.json(
      { error: "recording_delete_failed", details: deleteError.message },
      { status: 400 },
    );
  }

  try {
    await supabase.from("admin_audit_log").insert({
      actor_user_id: user.id,
      action: "recording_delete",
      payload: {
        recording_id: recordingId,
        storage_bucket: row.storage_bucket,
        storage_path: row.storage_path,
      },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, mode: "supabase" as const });
}
