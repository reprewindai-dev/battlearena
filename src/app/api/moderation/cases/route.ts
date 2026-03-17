import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionRole, getSessionUser } from "@/lib/auth/session";

function requireModOrAdmin(role: string) {
  return role === "mod" || role === "admin";
}

// GET /api/moderation/cases?status=open&page=0
export async function GET(req: NextRequest) {
  const role = await getSessionRole();
  if (!requireModOrAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "open";
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const limit = 25;
  const offset = page * limit;

  let query = supabase
    .from("moderation_cases")
    .select(`
      id,
      reason,
      status,
      created_at,
      updated_at,
      subject_user_id,
      battle_id,
      created_by
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: cases, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    cases: cases ?? [],
    total: count ?? 0,
    page,
    pages: Math.ceil((count ?? 0) / limit),
  });
}

// POST /api/moderation/cases — create a new case (users can report)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json();
  const { subject_user_id, battle_id, reason } = body;

  if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
    return NextResponse.json({ error: "Reason must be at least 10 characters" }, { status: 400 });
  }

  if (!subject_user_id && !battle_id) {
    return NextResponse.json({ error: "Must specify subject_user_id or battle_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("moderation_cases")
    .insert({
      created_by: user.id,
      subject_user_id: subject_user_id ?? null,
      battle_id: battle_id ?? null,
      reason: reason.trim(),
      status: "open",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ case: data }, { status: 201 });
}
