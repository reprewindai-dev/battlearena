import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createRequestLogContext, logStructured, withRequestId } from "@/lib/logging/structured";
import { recordReferralSignup } from "@/lib/growth/referrals";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";
import { env } from "@/env";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nextPath: z.string().optional(),
  inviteCode: z.string().trim().min(4).max(64).optional(),
});

function resolveSafeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/app";
  }

  return nextPath;
}

function shouldAutoConfirmSignupsInDev() {
  return process.env.NODE_ENV !== "production" && env.DEV_AUTO_CONFIRM_SIGNUPS !== "false";
}

async function safeEmitSignupEvent(event: {
  event_type: string;
  player_id?: string;
  event_data?: Record<string, unknown>;
}) {
  try {
    await getTelemetrySystem().emitEvent(event as any);
  } catch {
    // Telemetry must never block auth responses.
  }
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
    const emailDomain = parsed.data.email.split("@")[1] ?? null;

    await safeEmitSignupEvent({
      event_type: "SIGNUP_STARTED",
      event_data: {
        source: "password_signup",
        email_domain: emailDomain,
        has_invite_code: Boolean(parsed.data.inviteCode),
      },
    });

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo,
        data: parsed.data.inviteCode
          ? { referral_code: parsed.data.inviteCode.trim().toLowerCase() }
          : undefined,
      },
    });

    if (error) {
      await safeEmitSignupEvent({
        event_type: "SIGNUP_FAILED",
        event_data: {
          source: "password_signup",
          error: error.message,
          email_domain: emailDomain,
          has_invite_code: Boolean(parsed.data.inviteCode),
        },
      });
      logStructured("warn", "auth_signup_failed", logContext, {
        error: error.message,
      });
      const response = NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
      return withRequestId(response, logContext.request_id);
    }

    let hasActiveSession = Boolean(data.session);

    if (!hasActiveSession && data.user && shouldAutoConfirmSignupsInDev()) {
      try {
        const adminClient = createSupabaseServiceRoleClient();
        const { error: confirmError } = await adminClient.auth.admin.updateUserById(data.user.id, {
          email_confirm: true,
        });

        if (!confirmError) {
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
          });

          hasActiveSession = Boolean(loginData.session);
          if (loginError) {
            logStructured("warn", "auth_signup_dev_autoconfirm_login_failed", logContext, {
              error: loginError.message,
            });
          }
        } else {
          logStructured("warn", "auth_signup_dev_autoconfirm_confirm_failed", logContext, {
            error: confirmError.message,
          });
        }
      } catch (autoConfirmError) {
        logStructured("warn", "auth_signup_dev_autoconfirm_failed", logContext, {
          error:
            autoConfirmError instanceof Error
              ? autoConfirmError.message
              : "unknown_error",
        });
      }
    }

    if (data.user) {
      logContext.user_id = data.user.id;
      await ensurePublicUserRecord(supabase, data.user).catch(() => null);
      if (parsed.data.inviteCode) {
        try {
          const adminClient = createSupabaseServiceRoleClient();
          await recordReferralSignup(
            adminClient,
            data.user.id,
            parsed.data.inviteCode.trim().toLowerCase(),
          ).catch(() => null);
        } catch {
          // Non-fatal - attribution can be retried on callback
        }
      }
    }

    if (hasActiveSession && data.user) {
      await safeEmitSignupEvent({
        event_type: "SIGNUP_COMPLETED",
        player_id: data.user.id,
        event_data: {
          source: "password_signup",
          next_path: nextPath,
        },
      });
    }

    const response = NextResponse.json(
      {
        ok: true,
        requiresEmailConfirmation: !hasActiveSession,
        nextPath,
      },
      { status: 200, headers: getResponse().headers },
    );

    getResponse().cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });

    logStructured("info", "auth_signup_completed", logContext, {
      requires_email_confirmation: !hasActiveSession,
    });
    return withRequestId(response, logContext.request_id);
  } catch (error) {
    await safeEmitSignupEvent({
      event_type: "SIGNUP_FAILED",
      event_data: {
        source: "password_signup",
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });
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
