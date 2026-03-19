import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

const CASE_STATUSES = ["open", "in_review", "resolved", "escalated", "closed"] as const;
const createModerationCaseSchema = z
  .object({
    subject_user_id: z.string().uuid().optional().nullable(),
    battle_id: z.string().uuid().optional().nullable(),
    reason: z.string().trim().min(10).max(1000),
  })
  .refine((value) => Boolean(value.subject_user_id || value.battle_id), {
    message: "Must specify subject_user_id or battle_id",
  });

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

  if (status !== "all" && !CASE_STATUSES.includes(status as (typeof CASE_STATUSES)[number])) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

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

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensurePublicUserRecord(supabase, authData.user);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "user_bootstrap_failed" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createModerationCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("moderation_cases")
    .insert({
      created_by: user.id,
      subject_user_id: parsed.data.subject_user_id ?? null,
      battle_id: parsed.data.battle_id ?? null,
      reason: parsed.data.reason,
      status: "open",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ case: data }, { status: 201 });
}
