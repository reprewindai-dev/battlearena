import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createRequestLogContext, logStructured, withRequestId } from "@/lib/logging/structured";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";
import { env } from "@/env";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function shouldAutoConfirmSignupsInDev() {
  return process.env.NODE_ENV !== "production" && env.DEV_AUTO_CONFIRM_SIGNUPS !== "false";
}

async function safeEmitLoginEvent(event: {
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

async function resolveAuthUserIdByEmail(email: string) {
  const adminClient = createSupabaseServiceRoleClient();
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 200;
  let page = 1;

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const matchingUser = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail,
    );
    if (matchingUser) {
      return matchingUser.id;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const logContext = createRequestLogContext(request, "/api/auth/login");

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

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "invalid_credentials_payload" },
      { status: 400 },
    );
    return withRequestId(response, logContext.request_id);
  }

  try {
    const emailDomain = parsed.data.email.split("@")[1] ?? null;
    const { supabase, getResponse } = createSupabaseRouteClient(request);
    let { data, error } = await supabase.auth.signInWithPassword(parsed.data);

    if (
      error &&
      shouldAutoConfirmSignupsInDev() &&
      /email\s+not\s+confirmed/i.test(error.message)
    ) {
      try {
        const authUserId = await resolveAuthUserIdByEmail(parsed.data.email);
        if (authUserId) {
          const adminClient = createSupabaseServiceRoleClient();
          const { error: confirmError } = await adminClient.auth.admin.updateUserById(authUserId, {
            email_confirm: true,
          });

          if (!confirmError) {
            const retried = await supabase.auth.signInWithPassword(parsed.data);
            data = retried.data;
            error = retried.error;
          } else {
            logStructured("warn", "auth_login_dev_autoconfirm_confirm_failed", logContext, {
              error: confirmError.message,
            });
          }
        }
      } catch (autoConfirmError) {
        logStructured("warn", "auth_login_dev_autoconfirm_failed", logContext, {
          error:
            autoConfirmError instanceof Error
              ? autoConfirmError.message
              : "unknown_error",
        });
      }
    }

    if (error) {
      await safeEmitLoginEvent({
        event_type: "LOGIN_FAILED",
        event_data: {
          error: error.message,
          email_domain: emailDomain,
        },
      });
      logStructured("warn", "auth_login_failed", logContext, {
        error: error.message,
      });
      const response = NextResponse.json(
        { error: error.message },
        { status: 401 },
      );
      return withRequestId(response, logContext.request_id);
    }

    if (data.user) {
      logContext.user_id = data.user.id;
      await ensurePublicUserRecord(supabase, data.user).catch(() => null);

      // Fetch admin status and add to user metadata
      try {
        const adminClient = createSupabaseServiceRoleClient();
        const { data: userData } = await adminClient
          .from("users")
          .select("is_admin")
          .eq("id", data.user.id)
          .single();

        if (userData?.is_admin) {
          await supabase.auth.updateUser({
            data: { is_admin: true },
          });
        }
      } catch (error) {
        // Non-fatal - admin status will be checked on demand
      }

      await safeEmitLoginEvent({
        event_type: "LOGIN_COMPLETED",
        player_id: data.user.id,
        event_data: {
          email_domain: emailDomain,
        },
      });
    }

    const response = NextResponse.json(
      {
        ok: true,
        user: data.user
          ? {
              id: data.user.id,
              email: data.user.email ?? null,
            }
          : null,
      },
      { status: 200, headers: getResponse().headers },
    );

    getResponse().cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });

    logStructured("info", "auth_login_completed", logContext);
    return withRequestId(response, logContext.request_id);
  } catch (error) {
    await safeEmitLoginEvent({
      event_type: "LOGIN_FAILED",
      event_data: {
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });
    logStructured("error", "auth_login_route_failed", logContext, {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    const response = NextResponse.json(
      { error: "login_unavailable" },
      { status: 500 },
    );
    return withRequestId(response, logContext.request_id);
  }
}
