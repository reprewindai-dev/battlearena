import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import {
  createImmediateBotMatch,
  ensurePublicUser,
  normalizeQueueMode,
} from "@/lib/matchmaking/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const queueType = normalizeQueueMode(body.queueType);
    const battleFormat = typeof body.battleFormat === "string" ? body.battleFormat : "60s";

    const adminClient = createSupabaseServiceRoleClient();

    await ensurePublicUser(adminClient, user, user.email?.split("@")[0]);

    const result = await createImmediateBotMatch({
      adminClient,
      userId: user.id,
      queueType,
      battleFormat,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "bot_match_creation_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
