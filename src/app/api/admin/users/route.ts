import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionRole } from "@/lib/auth/session";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const search = searchParams.get("q")?.trim() ?? "";
  const roleFilter = searchParams.get("role") ?? "";

  let query = supabase
    .from("user_profiles")
    .select("id,handle,display_name,avatar_url,role,elo_rating,tier,token_balance,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (search) {
    query = query.or(`handle.ilike.%${search}%,display_name.ilike.%${search}%`);
  }
  if (roleFilter && roleFilter !== "all") {
    query = query.eq("role", roleFilter);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    users: data ?? [],
    total: count ?? 0,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  });
}
