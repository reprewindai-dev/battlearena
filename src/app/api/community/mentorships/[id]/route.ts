import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_STATUSES = new Set(["accepted", "declined", "completed", "cancelled"]);
const UpdateMentorshipSchema = z.object({
  status: z.enum(["accepted", "declined", "completed", "cancelled"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateMentorshipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }
  const status = parsed.data.status;
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("mentorships")
    .select("id,mentor_id,mentee_id,status")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.mentor_id !== user.id && existing.mentee_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (existing.status === "completed" || existing.status === "declined" || existing.status === "cancelled") {
    return NextResponse.json({ error: "mentorship_closed" }, { status: 409 });
  }
  if ((status === "accepted" || status === "declined") && existing.mentor_id !== user.id) {
    return NextResponse.json({ error: "mentor_action_required" }, { status: 403 });
  }
  if (status === "completed" && existing.status !== "accepted") {
    return NextResponse.json({ error: "accepted_mentorship_required" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("mentorships")
    .update({
      status,
      started_at: status === "accepted" && existing.status !== "accepted" ? new Date().toISOString() : undefined,
      ended_at: status === "accepted" ? null : new Date().toISOString(),
    })
    .eq("id", id)
    .select("id,mentor_id,mentee_id,status,started_at,ended_at,notes")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ item: data });
}
