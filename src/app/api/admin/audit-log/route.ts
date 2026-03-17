import { NextResponse } from "next/server";

import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  action: string;
  payload: unknown;
  created_at: string;
};

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 100;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 100;

  const action = url.searchParams.get("action");
  const q = url.searchParams.get("q");

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("admin_audit_log")
    .select("id,actor_user_id,action,payload,created_at")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (action && action.length > 0) {
    query = query.eq("action", action);
  }

  if (q && q.length > 0) {
    query = query.or(`action.ilike.%${q}%,payload::text.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "audit_log_fetch_failed", details: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, mode: "supabase" as const, rows: (data ?? []) as AuditLogRow[] });
}
