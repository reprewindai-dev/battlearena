import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("supabase_service_config_missing");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

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

    const body = await request.json().catch(() => ({}));
    const queueType = body.queueType ?? "freestyle";
    const battleFormat = body.battleFormat ?? "60s";
    const preferredGenres: string[] = Array.isArray(body.preferredGenres) ? body.preferredGenres : [];

    const adminClient = await getServiceClient();

    // Ensure public.users record exists
    const username =
      body.username ?? user.user_metadata?.username ?? user.email?.split("@")[0] ?? `user_${user.id.slice(0, 8)}`;

    const { error: upsertError } = await adminClient
      .from("users")
      .upsert(
        {
          id: user.id,
          email: user.email ?? `${username}@battlearena.com`,
          username,
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: "user_upsert_failed", details: upsertError.message }, { status: 500 });
    }

    // Remove any stale queue entries for this user
    await adminClient.from("matchmaking_queue").delete().eq("user_id", user.id);

    const { data: queueEntry, error: queueError } = await adminClient
      .from("matchmaking_queue")
      .insert({
        user_id: user.id,
        queue_type: queueType,
        battle_format: battleFormat,
        preferred_genres: preferredGenres,
        status: "active",
      })
      .select("id,battle_format,status,queue_type,user_id")
      .single();

    if (queueError) {
      return NextResponse.json({ error: "enqueue_failed", details: queueError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, entry: queueEntry });
  } catch (error: any) {
    return NextResponse.json({ error: "unknown_error", details: error.message ?? "" }, { status: 500 });
  }
}
