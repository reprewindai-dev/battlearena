import { NextResponse } from "next/server";

import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import { RemoteBeatManifestSchema, ingestRemoteBeatCatalog } from "@/lib/beats/admin-ingest";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

export async function POST(request: Request) {
  const user = await getSessionUser();
  const role = await getSessionRole();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && role !== "mod") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = RemoteBeatManifestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_manifest", details: parsed.error.flatten() }, { status: 400 });
  }

  const adminClient = createSupabaseServiceRoleClient();
  await ensurePublicUserRecord(adminClient, user);

  const result = await ingestRemoteBeatCatalog({
    adminClient,
    actorUserId: user.id,
    bucket: process.env.BEATS_STORAGE_BUCKET ?? "beats",
    tracks: parsed.data.tracks,
  });

  return NextResponse.json({ ok: true, ...result }, { status: 201 });
}
