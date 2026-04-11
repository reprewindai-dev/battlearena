import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const currency = searchParams.get("currency"); // 'tokens' | 'crowns' | null (all)
  const limit = Math.min(Number(searchParams.get("limit") ?? "30"), 100);
  const offset = Number(searchParams.get("offset") ?? "0");

  const adminClient = createSupabaseServiceRoleClient();

  let query = adminClient
    .from("wallet_transactions")
    .select("id,currency,amount,balance_after,type,description,reference_type,created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (currency) {
    query = query.eq("currency", currency);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transactions: data ?? [], total: count ?? 0 });
}
