import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createRequestLogContext, logStructured, withRequestId } from "@/lib/logging/structured";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nextPath: z.string().optional(),
});

function resolveSafeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/app";
  }

  return nextPath;
}

export async function POST(request: NextRequest) {
  const logContext = createRequestLogContext(request, "/api/auth/signup");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const response = NextResponse.json(
      { error: "invalid_payload" },
      { status: 400 },
    );
    return withRequestId(response, logContext.request_id);
  }

  const parsed = signupSchema.safeParse(payload);
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "invalid_signup_payload" },
      { status: 400 },
    );
    return withRequestId(response, logContext.request_id);
  }

  try {
    const { supabase, getResponse } = createSupabaseRouteClient(request);
    const nextPath = resolveSafeNextPath(parsed.data.nextPath);
    const origin = new URL(request.url).origin;
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo,
      },
    });

    if (error) {
      logStructured("warn", "auth_signup_failed", logContext, {
        error: error.message,
      });
      const response = NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
      return withRequestId(response, logContext.request_id);
    }

    if (data.user) {
      logContext.user_id = data.user.id;
      await ensurePublicUserRecord(supabase, data.user).catch(() => null);
    }

    if (data.session && data.user) {
      await getTelemetrySystem()
        .emitEvent({
          event_type: "SIGNUP_COMPLETED",
          player_id: data.user.id,
          event_data: {
            source: "password_signup",
            next_path: nextPath,
          },
        })
        .catch(() => null);
    }

    const response = NextResponse.json(
      {
        ok: true,
        requiresEmailConfirmation: !data.session,
        nextPath,
      },
      { status: 200, headers: getResponse().headers },
    );

    getResponse().cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });

    logStructured("info", "auth_signup_completed", logContext, {
      requires_email_confirmation: !data.session,
    });
    return withRequestId(response, logContext.request_id);
  } catch (error) {
    logStructured("error", "auth_signup_route_failed", logContext, {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    const response = NextResponse.json(
      { error: "signup_unavailable" },
      { status: 500 },
    );
    return withRequestId(response, logContext.request_id);
  }
}
