import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

export async function GET() {
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

  const { data, error } = await supabase
    .from("mentorships")
    .select("id,mentor_id,mentee_id,status,started_at,ended_at,notes")
    .or(`mentor_id.eq.${user.id},mentee_id.eq.${user.id}`)
    .order("started_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const userIds = Array.from(
    new Set(
      (data ?? []).flatMap((row: any) => [
        (row as { mentor_id: string }).mentor_id,
        (row as { mentee_id: string }).mentee_id,
      ]),
    ),
  );
  const { data: users } = userIds.length
    ? await supabase.from("users").select("id,username").in("id", userIds)
    : { data: [] as Array<{ id: string; username: string | null }> };

  const usersById = new Map((users ?? []).map((u: any) => [u.id, u]));

  return NextResponse.json({
    items: (data ?? []).map((row: any) => {
      const mentorId = (row as { mentor_id: string }).mentor_id;
      const menteeId = (row as { mentee_id: string }).mentee_id;
      return {
        ...row,
        mentor: usersById.get(mentorId) ?? null,
        mentee: usersById.get(menteeId) ?? null,
      };
    }),
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

  const body = (await req.json().catch(() => ({} as Record<string, unknown>))) as Record<string, unknown>;
  const mentorHandle = typeof body.mentorHandle === "string" ? body.mentorHandle.trim().toLowerCase() : "";
  const note = typeof body.note === "string" ? body.note.trim() : null;

  if (!mentorHandle) {
    return NextResponse.json({ error: "mentorHandle_required" }, { status: 400 });
  }

  const { data: mentor, error: mentorError } = await supabase
    .from("users")
    .select("id")
    .eq("username", mentorHandle)
    .maybeSingle();

  if (mentorError) {
    return NextResponse.json({ error: mentorError.message }, { status: 400 });
  }
  if (!mentor?.id) {
    return NextResponse.json({ error: "mentor_not_found" }, { status: 404 });
  }
  if (mentor.id === user.id) {
    return NextResponse.json({ error: "cannot_request_self" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("mentorships")
    .insert({
      mentor_id: mentor.id,
      mentee_id: user.id,
      status: "pending",
      notes: note,
    })
    .select("id,mentor_id,mentee_id,status,started_at,ended_at,notes")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}

