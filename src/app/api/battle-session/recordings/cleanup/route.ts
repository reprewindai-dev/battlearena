import { NextResponse } from "next/server";

import { isMockAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const recordingId =
    body && typeof body === "object" && "recordingId" in body
      ? ((body as Record<string, unknown>).recordingId as unknown)
      : null;

  if (typeof recordingId !== "string" || recordingId.length === 0) {
    return NextResponse.json({ error: "missing_recordingId" }, { status: 400 });
  }

  if (isMockAuthEnabled) {
    return NextResponse.json({ ok: true, mode: "mock" as const });
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: row, error: fetchError } = await supabase
    .from("battle_recordings")
    .select("id,storage_bucket,storage_path,uploaded_at")
    .eq("id", recordingId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: "recording_fetch_failed", details: fetchError.message },
      { status: 400 },
    );
  }

  if (!row) {
    return NextResponse.json({ ok: true, mode: "supabase" as const });
  }

  // Safety: only cleanup rows that were never finalized.
  if (row.uploaded_at) {
    return NextResponse.json(
      { error: "already_finalized" },
      { status: 409 },
    );
  }

  if (row.storage_bucket && row.storage_path) {
    try {
      await supabase.storage.from(row.storage_bucket).remove([row.storage_path]);
    } catch {
      // best-effort
    }
  }

  const { error: deleteError } = await supabase
    .from("battle_recordings")
    .delete()
    .eq("id", recordingId)
    .is("uploaded_at", null);

  if (deleteError) {
    return NextResponse.json(
      { error: "recording_cleanup_failed", details: deleteError.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, mode: "supabase" as const });
}
