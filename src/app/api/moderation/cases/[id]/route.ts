import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionRole, getSessionUser } from "@/lib/auth/session";

// GET /api/moderation/cases/[id] — case detail with actions
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const role = await getSessionRole();
  if (role !== "mod" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: modCase, error } = await supabase
    .from("moderation_cases")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !modCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const { data: actions } = await supabase
    .from("moderation_actions")
    .select("id, action_type, payload, created_at, actor_user_id")
    .eq("case_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ case: modCase, actions: actions ?? [] });
}

// PATCH /api/moderation/cases/[id] — update status / take action
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getSessionRole();
  if (role !== "mod" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json();
  const { status, action_type, action_payload, note } = body;

  const VALID_STATUSES = ["open", "in_review", "resolved", "escalated", "closed"];
  const VALID_ACTIONS = ["warn", "mute", "ban", "remove_content", "dismiss", "escalate", "close", "note"];

  // Update case status
  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const { error } = await supabase
      .from("moderation_cases")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Record moderation action
  const actionToRecord = action_type ?? (status ? `status_${status}` : null);
  if (actionToRecord) {
    if (!VALID_ACTIONS.includes(actionToRecord) && !actionToRecord.startsWith("status_")) {
      return NextResponse.json({ error: "Invalid action_type" }, { status: 400 });
    }

    const { error: actionError } = await supabase
      .from("moderation_actions")
      .insert({
        case_id: id,
        actor_user_id: user.id,
        action_type: actionToRecord,
        payload: {
          ...(action_payload ?? {}),
          ...(note ? { note } : {}),
        },
      });

    if (actionError) {
      return NextResponse.json({ error: actionError.message }, { status: 400 });
    }
  }

  // Re-fetch updated case
  const { data: updated } = await supabase
    .from("moderation_cases")
    .select("*")
    .eq("id", id)
    .single();

  return NextResponse.json({ case: updated });
}
