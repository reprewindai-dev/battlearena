import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: string;
  ends_at: string | null;
  host_user_id: string;
  is_public: boolean;
  max_attendees: number;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "8"), 25);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("community_events")
    .select("id,title,description,status,starts_at,ends_at,host_user_id,is_public,max_attendees,created_at")
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const events = (data ?? []) as EventRow[];
  const eventIds = events.map((e: any) => e.id);
  const hostIds = Array.from(new Set(events.map((e: any) => e.host_user_id)));

  const [{ data: hostProfiles }, { data: attendeeRows }, { data: myRows }] = await Promise.all([
    hostIds.length ? supabase.from("users").select("id,username").in("id", hostIds) : Promise.resolve({ data: [] }),
    eventIds.length ? supabase.from("community_event_attendees").select("event_id").in("event_id", eventIds).eq("status", "registered") : Promise.resolve({ data: [] }),
    user && eventIds.length
      ? supabase.from("community_event_attendees").select("event_id").in("event_id", eventIds).eq("user_id", user.id).eq("status", "registered")
      : Promise.resolve({ data: [] }),
  ]);

  const hostMap = new Map((hostProfiles ?? []).map((p: any) => [p.id, p]));
  const attendeeCountByEvent = new Map<string, number>();
  for (const row of attendeeRows ?? []) {
    const eventId = (row as { event_id: string }).event_id;
    attendeeCountByEvent.set(eventId, (attendeeCountByEvent.get(eventId) ?? 0) + 1);
  }
  const myEventSet = new Set((myRows ?? []).map((row: any) => (row as { event_id: string }).event_id));

  return NextResponse.json({
    items: events.map((event: any) => ({
      ...event,
      host: hostMap.get(event.host_user_id) ?? null,
      attendee_count: attendeeCountByEvent.get(event.id) ?? 0,
      is_registered: myEventSet.has(event.id),
    })),
  });
}

export async function POST(req: NextRequest) {
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

  const body = (await req.json().catch(() => ({} as Record<string, unknown>))) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const startsAtRaw = typeof body.startsAt === "string" ? body.startsAt : "";
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;

  if (title.length < 3 || title.length > 120) {
    return NextResponse.json({ error: "title_must_be_3_to_120_chars" }, { status: 400 });
  }
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "invalid_startsAt" }, { status: 400 });
  }
  if (startsAt.getTime() < Date.now() + 60_000) {
    return NextResponse.json({ error: "startsAt_must_be_future" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("community_events")
    .insert({
      title,
      description,
      starts_at: startsAt.toISOString(),
      host_user_id: user.id,
      status: "scheduled",
      is_public: true,
    })
    .select("id,title,description,status,starts_at,ends_at,host_user_id,is_public,max_attendees,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}

