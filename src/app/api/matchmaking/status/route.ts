import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import {
  normalizeQueueMode,
  runMatchmakingStep,
} from "@/lib/matchmaking/server";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const queueType = normalizeQueueMode(url.searchParams.get("mode") ?? url.searchParams.get("queueType"));
  const battleFormat = url.searchParams.get("battleFormat") ?? "60s";
  try {
    const adminClient = createSupabaseServiceRoleClient();

    const result = await runMatchmakingStep({
      adminClient,
      userId: user.id,
      queueType,
      battleFormat,
      preferredGenres: [],
      leave: false,
      createIfMissing: false,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Matchmaking status error:", error);
    return NextResponse.json(
      {
        error: "status_failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
