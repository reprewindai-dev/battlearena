import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("supabase_service_config_missing");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: { battleId: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const adminClient = await getServiceClient();

    // Get battle with related data
    const { data: battle, error: battleError } = await adminClient
      .from("battles")
      .select(`
        *,
        beat:beats(*),
        participant_1:users!battles_participant_1_id_fkey(*),
        participant_2:users!battles_participant_2_id_fkey(*)
      `)
      .eq("id", params.battleId)
      .single();

    if (battleError || !battle) {
      return NextResponse.json({ error: "battle_not_found" }, { status: 404 });
    }

    // Check if user is part of this battle
    if (battle.participant_1_id !== user.id && battle.participant_2_id !== user.id) {
      return NextResponse.json({ error: "not_participant" }, { status: 403 });
    }

    return NextResponse.json({ battle });
  } catch (error: any) {
    return NextResponse.json({ error: "unknown_error", details: error.message ?? "" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { battleId: string } }
) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { winner, scores } = body;

    const adminClient = await getServiceClient();

    // Update battle with results
    const { data: updatedBattle, error: updateError } = await adminClient
      .from("battles")
      .update({
        status: "completed",
        winner: winner === "user" ? user.id : "bot",
        participant_1_score: scores.userScore,
        participant_2_score: scores.botScore,
        completed_at: new Date().toISOString(),
      })
      .eq("id", params.battleId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: "battle_update_failed", details: updateError.message }, { status: 500 });
    }

    // Update user stats
    const { error: statsError } = await adminClient
      .from("users")
      .update({
        battles_played: (updatedBattle.participant_1?.battles_played || 0) + 1,
        wins: winner === "user" ? (updatedBattle.participant_1?.wins || 0) + 1 : (updatedBattle.participant_1?.wins || 0),
        losses: winner === "bot" ? (updatedBattle.participant_1?.losses || 0) + 1 : (updatedBattle.participant_1?.losses || 0),
        skill_level: winner === "user" 
          ? Math.min(100, ((updatedBattle.participant_1?.skill_level || 50) + 5))
          : Math.max(0, ((updatedBattle.participant_1?.skill_level || 50) - 3)),
      })
      .eq("id", user.id);

    if (statsError) {
      console.error("Failed to update user stats:", statsError);
    }

    return NextResponse.json({ 
      ok: true, 
      battle: updatedBattle,
      message: `Battle completed! ${winner === "user" ? "You won!" : "Bot won!"}`
    });

  } catch (error: any) {
    return NextResponse.json({ error: "unknown_error", details: error.message ?? "" }, { status: 500 });
  }
}
