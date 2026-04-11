import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const VoteSchema = z.object({
  vote: z.enum(["for", "against", "abstain"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = VoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vote. Must be 'for', 'against', or 'abstain'" }, { status: 400 });
  }

  const { vote } = parsed.data;
  const adminClient = createSupabaseServiceRoleClient();

  const { data: proposal } = await adminClient
    .from("governance_proposals")
    .select("id,status,voting_ends_at,votes_for,votes_against,votes_abstain")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  const typedProposal = proposal as {
    id: string;
    status: string;
    voting_ends_at: string;
    votes_for: number;
    votes_against: number;
    votes_abstain: number;
  };

  if (typedProposal.status !== "open") {
    return NextResponse.json({ error: "This proposal is no longer open for voting" }, { status: 409 });
  }

  if (new Date(typedProposal.voting_ends_at) < new Date()) {
    return NextResponse.json({ error: "Voting period has ended" }, { status: 409 });
  }

  // Check for existing vote
  const { data: existingVote } = await adminClient
    .from("governance_votes")
    .select("id,vote")
    .eq("proposal_id", proposalId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingVote) {
    return NextResponse.json({ error: "You have already voted on this proposal" }, { status: 409 });
  }

  // Record vote
  await adminClient.from("governance_votes").insert({
    proposal_id: proposalId,
    user_id: user.id,
    vote,
    weight: 1,
  });

  // Update counts
  const updates: Record<string, number> = {};
  if (vote === "for") updates.votes_for = typedProposal.votes_for + 1;
  else if (vote === "against") updates.votes_against = typedProposal.votes_against + 1;
  else updates.votes_abstain = typedProposal.votes_abstain + 1;

  await adminClient
    .from("governance_proposals")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", proposalId);

  return NextResponse.json({ ok: true, vote });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ userVote: null });

  const adminClient = createSupabaseServiceRoleClient();
  const { data } = await adminClient
    .from("governance_votes")
    .select("vote")
    .eq("proposal_id", proposalId)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ userVote: (data as { vote?: string } | null)?.vote ?? null });
}
