import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("matchmaking_status", { p_mode: mode });

  if (error) {
    return NextResponse.json({ error: "status_failed", details: error.message }, { status: 400 });
  }

  const status =
    data && typeof data === "object" && "status" in data ? String((data as { status?: unknown }).status) : "none";
  const battleId =
    data && typeof data === "object" && "battle_id" in data ? (data as { battle_id?: string }).battle_id : null;

  return NextResponse.json({ ok: true, mode: "supabase", status, battleId, data });
}
