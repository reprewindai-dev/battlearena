import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BotOpponent, selectBotOpponent } from "@/lib/ai/bot-opponent";
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

export async function POST(request: Request) {
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
    const queueType = body.queueType ?? "freestyle";
    const battleFormat = body.battleFormat ?? "60s";
    const preferredGenres: string[] = Array.isArray(body.preferredGenres) ? body.preferredGenres : [];
    const beatId = body.beatId;

    const adminClient = await getServiceClient();

    // Get user's skill level (default to 50 if not set)
    const { data: userProfile } = await adminClient
      .from("users")
      .select("skill_level, wins, losses")
      .eq("id", user.id)
      .single();

    const skillLevel = userProfile?.skill_level || 50;

    // Select appropriate bot opponent
    const botPersonality = selectBotOpponent(skillLevel);
    const botOpponent = new BotOpponent(botPersonality.id, null);

    // Get a random beat for the battle
    let beat = null;
    if (beatId) {
      const { data: selectedBeat } = await adminClient
        .from("beats")
        .select("*")
        .eq("id", beatId)
        .single();
      beat = selectedBeat;
    } else {
      const { data: randomBeat } = await adminClient
        .from("beats")
        .select("*")
        .eq("is_active", true)
        .order("RANDOM()")
        .limit(1)
        .single();
      beat = randomBeat;
    }

    // Create bot battle session
    const { data: battle, error: battleError } = await adminClient
      .from("battles")
      .insert({
        created_by: user.id,
        participant_1_id: user.id,
        participant_2_id: null, // Bot opponent
        battle_type: queueType === "ranked" ? "ranked_bot" : "casual_bot",
        battle_format: battleFormat,
        beat_id: beat?.id,
        status: "active",
        is_bot_battle: true,
        bot_personality_id: botPersonality.id,
        bot_difficulty: botPersonality.difficulty,
        current_round: 1,
        max_rounds: 3,
        participant_1_score: 0,
        participant_2_score: 0,
      })
      .select("*")
      .single();

    if (battleError) {
      return NextResponse.json({ error: "battle_creation_failed", details: battleError.message }, { status: 500 });
    }

    // Create battle session for tracking
    const { data: session, error: sessionError } = await adminClient
      .from("battle_sessions")
      .insert({
        battle_id: battle.id,
        user_id: user.id,
        status: "active",
        current_round: 1,
        is_bot_battle: true,
        bot_personality_id: botPersonality.id,
      })
      .select("*")
      .single();

    if (sessionError) {
      return NextResponse.json({ error: "session_creation_failed", details: sessionError.message }, { status: 500 });
    }

    // Remove user from matchmaking queue
    await adminClient.from("matchmaking_queue").delete().eq("user_id", user.id);

    return NextResponse.json({
      ok: true,
      battle: {
        ...battle,
        beat,
        botOpponent: botPersonality,
        session,
      },
      message: `Matched with ${botPersonality.name}!`
    });

  } catch (error: any) {
    return NextResponse.json({ error: "unknown_error", details: error.message ?? "" }, { status: 500 });
  }
}
