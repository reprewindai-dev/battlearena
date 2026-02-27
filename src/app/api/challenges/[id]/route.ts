import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// PATCH - accept or decline
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body; // accept | decline

  if (!["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "action must be accept or decline" }, { status: 400 });
  }

  const { data: challenge, error: fetchError } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", id)
    .eq("challenged_id", user.id)
    .eq("status", "pending")
    .single();

  if (fetchError || !challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("challenges")
    .update({ status: action === "accept" ? "accepted" : "declined", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify challenger
  await supabase.from("notifications").insert({
    user_id: challenge.challenger_id,
    type: "challenge",
    title: action === "accept" ? "Challenge accepted!" : "Challenge declined",
    body: action === "accept" ? "Your challenge was accepted. Battle incoming!" : "Your challenge was declined.",
    actor_id: user.id,
    link: `/app/battles`,
  });

  return NextResponse.json({ challenge: data });
}
