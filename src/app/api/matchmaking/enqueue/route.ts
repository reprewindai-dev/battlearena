import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body: Record<string, unknown> = await request
      .json()
      .catch(() => ({} as Record<string, unknown>));
    const queueType = normalizeQueueMode(body.queueType);
    const battleFormat = typeof body.battleFormat === "string" ? body.battleFormat : "60s";
    const preferredGenres = Array.isArray(body.preferredGenres)
      ? body.preferredGenres.filter((v): v is string => typeof v === "string")
      : [];
    const leave = body.action === "leave" || body.leave === true;
    const idempotencyKeyFromBody =
      typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const idempotencyKeyFromHeader = request.headers.get("x-idempotency-key")?.trim() ?? "";
    const idempotencyKey = idempotencyKeyFromHeader || idempotencyKeyFromBody;
    const adminClient = createSupabaseServiceRoleClient();
    const scope = `matchmaking:enqueue:${queueType}`;

    const username =
      (typeof body.username === "string" && body.username) ||
      user.email?.split("@")[0];

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
