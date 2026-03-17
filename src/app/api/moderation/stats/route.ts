import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionRole } from "@/lib/auth/session";

export async function GET() {
  const role = await getSessionRole();
  if (role !== "mod" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const [openRes, inReviewRes, resolvedRes, escalatedRes] = await Promise.all([
    supabase.from("moderation_cases").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("moderation_cases").select("id", { count: "exact", head: true }).eq("status", "in_review"),
    supabase.from("moderation_cases").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    supabase.from("moderation_cases").select("id", { count: "exact", head: true }).eq("status", "escalated"),
  ]);

  return NextResponse.json({
    open: openRes.count ?? 0,
    in_review: inReviewRes.count ?? 0,
    resolved: resolvedRes.count ?? 0,
    escalated: escalatedRes.count ?? 0,
  });
}
