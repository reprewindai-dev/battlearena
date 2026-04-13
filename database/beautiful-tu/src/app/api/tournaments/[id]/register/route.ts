import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { markReferralActivated } from "@/lib/growth/referrals";
import { createRequestLogContext, logStructured, withRequestId } from "@/lib/logging/structured";
import { sendSystemNotification } from "@/lib/notifications/system";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const logContext = createRequestLogContext(req, "/api/tournaments/[id]/register", {
    tournament_id: id,
  });
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    logStructured("error", "tournament_register_supabase_unavailable", logContext);
    return withRequestId(
      NextResponse.json({ error: "Service unavailable" }, { status: 503 }),
      logContext.request_id,
    );
  }
  const adminClient = createSupabaseServiceRoleClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    logStructured("warn", "tournament_register_unauthorized", logContext);
    return withRequestId(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      logContext.request_id,
    );
  }
  logContext.user_id = user.id;
  try {
    await ensurePublicUserRecord(supabase, user);
  } catch (error) {
    logStructured("warn", "tournament_register_user_bootstrap_failed", logContext, {
      error: error instanceof Error ? error.message : "user_bootstrap_failed",
    });
    return withRequestId(
      NextResponse.json({ error: error instanceof Error ? error.message : "user_bootstrap_failed" }, { status: 400 }),
      logContext.request_id,
    );
  }

  const { data: registrationResult, error: registrationError } = await adminClient.rpc(
    "register_tournament_participant_runtime",
    {
      p_tournament_id: id,
      p_user_id: user.id,
    },
  );

  if (registrationError) {
    await getTelemetrySystem()
      .emitEvent({
        event_type: "TOURNAMENT_REGISTRATION_FAILED",
        player_id: user.id,
        event_data: {
          tournament_id: id,
          error: registrationError.message,
        },
      })
      .catch(() => null);
    logStructured("error", "tournament_register_rpc_failed", logContext, {
      error: registrationError.message,
    });
    return withRequestId(
      NextResponse.json({ error: registrationError.message }, { status: 500 }),
      logContext.request_id,
    );
  }

  const typedRegistrationResult = (registrationResult ?? {}) as {
    ok?: boolean;
    error?: string;
    status_code?: number;
    current_balance?: number;
    participant?: unknown;
    tournament_name?: string;
  };

  if (!typedRegistrationResult.ok) {
    const responseBody: Record<string, unknown> = {
      error: typedRegistrationResult.error ?? "tournament_registration_failed",
    };

    if (typeof typedRegistrationResult.current_balance === "number") {
      responseBody.current_balance = typedRegistrationResult.current_balance;
    }

    await getTelemetrySystem()
      .emitEvent({
        event_type: "TOURNAMENT_REGISTRATION_FAILED",
        player_id: user.id,
        event_data: {
          tournament_id: id,
          error: typedRegistrationResult.error ?? "tournament_registration_failed",
        },
      })
      .catch(() => null);

    logStructured("warn", "tournament_register_rejected", logContext, {
      error: typedRegistrationResult.error ?? "tournament_registration_failed",
      current_balance: typedRegistrationResult.current_balance ?? null,
    });

    return withRequestId(
      NextResponse.json(responseBody, {
        status: typeof typedRegistrationResult.status_code === "number" ? typedRegistrationResult.status_code : 409,
      }),
      logContext.request_id,
    );
  }

  await supabase.from("activity_feed").insert({
    actor_id: user.id,
    type: "joined_tournament",
    subject_id: id,
    subject_type: "tournament",
    meta: { tournament_name: typedRegistrationResult.tournament_name ?? null },
  });

  await getTelemetrySystem()
    .emitEvent({
      event_type: "TOURNAMENT_REGISTERED",
      player_id: user.id,
      event_data: {
        tournament_id: id,
        tournament_name: typedRegistrationResult.tournament_name ?? null,
      },
    })
    .catch(() => null);

  await sendSystemNotification(adminClient, {
    userId: user.id,
    title: "Tournament registration confirmed",
    body: `You are registered for ${typedRegistrationResult.tournament_name ?? "the tournament"}.`,
    link: "/app/tournaments",
  }).catch(() => null);

  await markReferralActivated(adminClient, user.id, "first_tournament_registration").catch(() => null);

  logStructured("info", "tournament_registered", logContext, {
    tournament_name: typedRegistrationResult.tournament_name ?? null,
  });

  return withRequestId(
    NextResponse.json({ participant: typedRegistrationResult.participant }, { status: 201 }),
    logContext.request_id,
  );
}
