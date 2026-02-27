import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionRole } from "@/lib/auth/session";

const ALLOWED_ROLES = ["user", "mod", "admin", "banned"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};

  if (body.role !== undefined) {
    if (!ALLOWED_ROLES.includes(body.role as AllowedRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updates.role = body.role;
  }

  if (body.token_balance !== undefined) {
    const tokens = parseInt(String(body.token_balance), 10);
    if (!Number.isFinite(tokens) || tokens < 0) {
      return NextResponse.json({ error: "Invalid token_balance" }, { status: 400 });
    }
    updates.token_balance = tokens;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", id)
    .select("id,handle,display_name,role,elo_rating,tier,token_balance")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ user: data });
}
