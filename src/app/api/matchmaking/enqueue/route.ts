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
  const mode =
    body && typeof body === "object" && "mode" in body
      ? ((body as Record<string, unknown>).mode as unknown)
      : null;

  const resolvedMode = typeof mode === "string" && mode.length > 0 ? mode : "freestyle";

  if (isMockAuthEnabled) {
    return NextResponse.json({
      ok: true,
      mode: "mock",
      matched: true,
      battleId: `mock_${crypto.randomUUID()}`,
    });
  }

  const supabase = await createSupabaseServerClient();

  const idempotencyKey = `enqueue:${user.id}:${resolvedMode}:${Date.now()}`;
  const { data, error } = await supabase.rpc("matchmake_enqueue", {
    p_idempotency_key: idempotencyKey,
    p_mode: resolvedMode,
  });

  if (error) {
    return NextResponse.json({ error: "enqueue_failed", details: error.message }, { status: 400 });
  }

  const battleId =
    data && typeof data === "object" && "battle_id" in data ? (data as { battle_id?: string }).battle_id : null;
  const matched =
    data && typeof data === "object" && "matched" in data ? Boolean((data as { matched?: unknown }).matched) : false;

  return NextResponse.json({ ok: true, mode: "supabase", matched, battleId, data });
}
