import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import {
  ensurePublicUser,
  normalizeQueueMode,
  readIdempotentMatchmakingResult,
  runMatchmakingStep,
  writeIdempotentMatchmakingResult,
} from "@/lib/matchmaking/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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
      user.user_metadata?.username ||
      user.email?.split("@")[0];

    await ensurePublicUser(adminClient, user, username);

    if (idempotencyKey) {
      const existing = await readIdempotentMatchmakingResult({
        adminClient,
        userId: user.id,
        key: idempotencyKey,
        scope,
      });
      if (existing) {
        return NextResponse.json(existing.response, { status: existing.statusCode });
      }
    }

    const result = await runMatchmakingStep({
      adminClient,
      userId: user.id,
      queueType,
      battleFormat,
      preferredGenres,
      leave,
      idempotencyKey: idempotencyKey || undefined,
    });

    if (idempotencyKey) {
      await writeIdempotentMatchmakingResult({
        adminClient,
        userId: user.id,
        key: idempotencyKey,
        scope,
        statusCode: 200,
        response: result,
      });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "matchmaking_enqueue_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
