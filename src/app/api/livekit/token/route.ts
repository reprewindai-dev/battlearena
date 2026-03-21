import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

import { createRequestLogContext, logStructured, withRequestId } from "@/lib/logging/structured";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";

function getRole(user: { isParticipant: boolean }): "participant" | "spectator" {
  if (user.isParticipant) return "participant";
  return "spectator";
}

export async function GET(request: NextRequest) {
  const logContext = createRequestLogContext(request, "/api/livekit/token");
  const { searchParams } = new URL(request.url);
  const room = searchParams.get("room");
  const requestedParticipant = searchParams.get("participant");
  logContext.battle_id = room;

  if (!room) {
    logStructured("warn", "livekit_token_room_required", logContext);
    return withRequestId(
      NextResponse.json({ error: "room_required" }, { status: 400 }),
      logContext.request_id,
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    logStructured("error", "livekit_token_supabase_unavailable", logContext);
    return withRequestId(
      NextResponse.json({ error: "supabase_not_configured" }, { status: 500 }),
      logContext.request_id,
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    logStructured("warn", "livekit_token_unauthorized", logContext);
    return withRequestId(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      logContext.request_id,
    );
  }
  logContext.user_id = user.id;

  // Participant identity is always bound to authenticated user to prevent token spoofing.
  const participant = user.id;

  const { data: battle, error: battleError } = await supabase
    .from("battles")
    .select("id,created_by,status")
    .eq("id", room)
    .maybeSingle();

  if (battleError) {
    logStructured("error", "livekit_token_battle_lookup_failed", logContext, {
      error: battleError.message,
    });
    return withRequestId(
      NextResponse.json({ error: "battle_lookup_failed", details: battleError.message }, { status: 400 }),
      logContext.request_id,
    );
  }

  if (!battle) {
    logStructured("warn", "livekit_token_battle_not_found", logContext);
    return withRequestId(
      NextResponse.json({ error: "battle_not_found" }, { status: 404 }),
      logContext.request_id,
    );
  }
  if (battle.status === "complete" || battle.status === "canceled") {
    logStructured("warn", "livekit_token_battle_not_joinable", logContext, {
      battle_status: battle.status,
    });
    return withRequestId(
      NextResponse.json({ error: "battle_not_joinable" }, { status: 409 }),
      logContext.request_id,
    );
  }

  const { data: participantRow } = await supabase
    .from("battle_participants")
    .select("id")
    .eq("battle_id", room)
    .eq("user_id", user.id)
    .maybeSingle();

  const viewerRole = getRole({ isParticipant: Boolean(participantRow) || battle.created_by === user.id });
  if (viewerRole === "spectator") {
    await getTelemetrySystem()
      .emitEvent({
        event_type: "LIVEKIT_TOKEN_FAILED",
        player_id: user.id,
        match_id: room,
        event_data: { reason: "not_participant" },
      })
      .catch(() => null);

    logStructured("warn", "livekit_token_not_participant", logContext);
    return withRequestId(
      NextResponse.json({ error: "not_participant" }, { status: 403 }),
      logContext.request_id,
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    await getTelemetrySystem()
      .emitEvent({
        event_type: "LIVEKIT_TOKEN_FAILED",
        player_id: user.id,
        match_id: room,
        event_data: { reason: "livekit_env_missing" },
      })
      .catch(() => null);

    logStructured("error", "livekit_token_env_missing", logContext);
    return withRequestId(
      NextResponse.json(
      { error: "livekit_env_missing", details: "LIVEKIT_API_KEY, LIVEKIT_API_SECRET, NEXT_PUBLIC_LIVEKIT_URL" },
      { status: 500 },
      ),
      logContext.request_id,
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

    await getTelemetrySystem()
      .emitEvent({
        event_type: "LIVEKIT_TOKEN_ISSUED",
        player_id: user.id,
        match_id: room,
        event_data: {
          role: viewerRole,
          requested_participant: requestedParticipant ?? null,
        },
      })
      .catch(() => null);

    logStructured("info", "livekit_token_issued", logContext, {
      role: viewerRole,
      participant,
    });

    return withRequestId(
      NextResponse.json({
        token: jwt,
        url: livekitUrl,
        room,
        participant,
        role: viewerRole,
      }),
      logContext.request_id,
    );
  } catch (error) {
    await getTelemetrySystem()
      .emitEvent({
        event_type: "LIVEKIT_TOKEN_FAILED",
        player_id: user.id,
        match_id: room,
        event_data: { reason: error instanceof Error ? error.message : "unknown_error" },
      })
      .catch(() => null);

    logStructured("error", "livekit_token_generation_failed", logContext, {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return withRequestId(
      NextResponse.json({ error: "livekit_token_generation_failed" }, { status: 500 }),
      logContext.request_id,
    );
  }
}
