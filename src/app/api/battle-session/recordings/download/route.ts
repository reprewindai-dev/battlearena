import { NextResponse } from "next/server";

import { isMockAuthEnabled } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const recordingId = url.searchParams.get("recordingId");
  if (!recordingId) {
    return NextResponse.json({ error: "missing_recordingId" }, { status: 400 });
  }

  if (isMockAuthEnabled) {
    return NextResponse.json({ ok: true, mode: "mock", url: "" });
  }

  const supabase = await createSupabaseServerClient();

  const { data: row, error } = await supabase
    .from("battle_recordings")
    .select("id,storage_bucket,storage_path")
    .eq("id", recordingId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "recording_fetch_failed", details: error.message }, { status: 400 });
  }

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!row.storage_bucket || !row.storage_path) {
    return NextResponse.json({ error: "no_storage_object" }, { status: 400 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, 60);

  if (signError || !signed) {
    return NextResponse.json(
      { error: "signed_url_failed", details: signError?.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, mode: "supabase", url: signed.signedUrl });
}
