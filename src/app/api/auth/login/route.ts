import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createRequestLogContext, logStructured, withRequestId } from "@/lib/logging/structured";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

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
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      await getTelemetrySystem()
        .emitEvent({
          event_type: "LOGIN_FAILED",
          event_data: {
            error: error.message,
            email_domain: emailDomain,
          },
        })
        .catch(() => null);
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

      await getTelemetrySystem()
        .emitEvent({
          event_type: "LOGIN_COMPLETED",
          player_id: data.user.id,
          event_data: {
            email_domain: emailDomain,
          },
        })
        .catch(() => null);
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
    await getTelemetrySystem()
      .emitEvent({
        event_type: "LOGIN_FAILED",
        event_data: {
          error: error instanceof Error ? error.message : "unknown_error",
        },
      })
      .catch(() => null);
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
