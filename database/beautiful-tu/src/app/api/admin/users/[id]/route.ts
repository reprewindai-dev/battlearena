import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { getSessionRole, getSessionUser } from "@/lib/auth/session";

const ALLOWED_ROLES = ["user", "mod", "admin", "banned"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];
const UpdateAdminUserSchema = z
  .object({
    role: z.enum(ALLOWED_ROLES).optional(),
    token_balance: z.number().int().min(0).max(1_000_000_000).optional(),
  })
  .refine((value) => typeof value.role !== "undefined" || typeof value.token_balance !== "undefined", {
    message: "No valid fields to update",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getSessionRole();
  const actor = await getSessionUser();
  if (role !== "admin" || !actor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = UpdateAdminUserSchema.safeParse({
    role:
      typeof (body as { role?: unknown }).role === "string"
        ? ((body as { role: string }).role as AllowedRole)
        : undefined,
    token_balance:
      typeof (body as { token_balance?: unknown }).token_balance === "number"
        ? (body as { token_balance: number }).token_balance
        : typeof (body as { token_balance?: unknown }).token_balance === "string"
          ? Number.parseInt((body as { token_balance: string }).token_balance, 10)
          : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }
  if (id === actor.id && (parsed.data.role === "banned" || parsed.data.role === "user" || parsed.data.role === "mod")) {
    return NextResponse.json({ error: "cannot_reduce_own_admin_access" }, { status: 409 });
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .update(parsed.data)
    .eq("id", id)
    .select("id,handle,display_name,role,elo_rating,tier,token_balance")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("admin_audit_log").insert({
    actor_user_id: actor.id,
    action: "admin_user_update",
    payload: {
      target_user_id: id,
      updates: parsed.data,
    },
  });

  return NextResponse.json({ user: data });
}
