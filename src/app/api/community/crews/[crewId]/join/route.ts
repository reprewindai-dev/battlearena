import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ crewId: string }> },
) {
  const { crewId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensurePublicUserRecord(supabase, user);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "user_bootstrap_failed" },
      { status: 400 },
    );
  }

  const { data: crew, error: crewError } = await supabase
    .from("crews")
    .select("id,member_count")
    .eq("id", crewId)
    .maybeSingle();

  if (crewError) {
    return NextResponse.json({ error: crewError.message }, { status: 400 });
  }
  if (!crew) {
    return NextResponse.json({ error: "crew_not_found" }, { status: 404 });
  }

  const { data: currentMembers } = await supabase
    .from("crew_members")
    .select("id")
    .eq("crew_id", crewId);

  const { error: joinError } = await supabase.from("crew_members").upsert(
    {
      crew_id: crewId,
      user_id: user.id,
      role: "member",
    },
    { onConflict: "crew_id,user_id" },
  );

  if (joinError) {
    return NextResponse.json({ error: joinError.message }, { status: 400 });
  }

  const nextCount = Math.max(crew.member_count ?? 0, (currentMembers?.length ?? 0) + 1);
  await supabase.from("crews").update({ member_count: nextCount }).eq("id", crewId);

  return NextResponse.json({ ok: true });
}
