import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const CreateProposalSchema = z.object({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(20).max(2000),
  category: z.enum(["rules", "economy", "features", "moderation", "community", "tournaments", "general"]).default("general"),
  voting_days: z.number().int().min(1).max(30).default(7),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "open";
  const category = searchParams.get("category");
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
  const offset = Number(searchParams.get("offset") ?? "0");

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let query = supabase
    .from("governance_proposals")
    .select(`
      id, title, description, category, status, votes_for, votes_against,
      votes_abstain, quorum_required, voting_ends_at, result, created_at, proposed_by
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== "all") query = query.eq("status", status);
  if (category) query = query.eq("category", category);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ proposals: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = CreateProposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, category, voting_days } = parsed.data;
  const votingEndsAt = new Date(Date.now() + voting_days * 24 * 60 * 60 * 1000).toISOString();

  const adminClient = createSupabaseServiceRoleClient();
  const { data, error } = await adminClient
    .from("governance_proposals")
    .insert({
      title,
      description,
      category,
      proposed_by: user.id,
      voting_ends_at: votingEndsAt,
      quorum_required: 10,
    })
    .select("id,title,status,voting_ends_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ proposal: data }, { status: 201 });
}
