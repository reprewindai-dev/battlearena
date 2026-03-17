import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensurePublicUserRecord(supabase, user);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "user_bootstrap_failed" },
      { status: 400 },
    );
  }

  const { data: event, error: eventError } = await supabase
    .from("community_events")
    .select("id,max_attendees,status")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 400 });
  }
  if (!event) {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }
  if (event.status !== "scheduled" && event.status !== "live") {
    return NextResponse.json({ error: "event_not_joinable" }, { status: 409 });
  }

  const { data: rows } = await supabase
    .from("community_event_attendees")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "registered");

  if ((rows?.length ?? 0) >= event.max_attendees) {
    return NextResponse.json({ error: "event_full" }, { status: 409 });
  }

  const { error: joinError } = await supabase.from("community_event_attendees").upsert(
    {
      event_id: eventId,
      user_id: user.id,
      status: "registered",
    },
    { onConflict: "event_id,user_id" },
  );

  if (joinError) {
    return NextResponse.json({ error: joinError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
