import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function getRole(user: { isParticipant: boolean }): "participant" | "spectator" {
  if (user.isParticipant) return "participant";
  return "spectator";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const room = searchParams.get("room");
  const requestedParticipant = searchParams.get("participant");

  if (!room) {
    return NextResponse.json({ error: "room_required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Participant identity is always bound to authenticated user to prevent token spoofing.
  const participant = user.id;

  const { data: battle, error: battleError } = await supabase
    .from("battles")
    .select("id,created_by,status")
    .eq("id", room)
    .maybeSingle();

  if (battleError) {
    return NextResponse.json({ error: "battle_lookup_failed", details: battleError.message }, { status: 400 });
  }

  if (!battle) {
    return NextResponse.json({ error: "battle_not_found" }, { status: 404 });
  }
  if (battle.status === "complete" || battle.status === "canceled") {
    return NextResponse.json({ error: "battle_not_joinable" }, { status: 409 });
  }

  const { data: participantRow } = await supabase
    .from("battle_participants")
    .select("id")
    .eq("battle_id", room)
    .eq("user_id", user.id)
    .maybeSingle();

  const viewerRole = getRole({ isParticipant: Boolean(participantRow) || battle.created_by === user.id });
  if (viewerRole === "spectator") {
    return NextResponse.json({ error: "not_participant" }, { status: 403 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json(
      { error: "livekit_env_missing", details: "LIVEKIT_API_KEY, LIVEKIT_API_SECRET, NEXT_PUBLIC_LIVEKIT_URL" },
      { status: 500 },
    );
  }

  try {
    const token = new AccessToken(apiKey, apiSecret, {
      identity: participant,
      name: participant,
      metadata: JSON.stringify({
        battleId: room,
        role: viewerRole,
        requestedParticipant: requestedParticipant ?? null,
      }),
    });

    token.addGrant({
      room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
    });
    const jwt = await token.toJwt();

    return NextResponse.json({
      token: jwt,
      url: livekitUrl,
      room,
      participant,
      role: viewerRole,
    });
  } catch (error) {
    console.error("Error generating LiveKit token:", error);
    return NextResponse.json({ error: "livekit_token_generation_failed" }, { status: 500 });
  }
}
