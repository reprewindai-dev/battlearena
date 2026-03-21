import { NextResponse } from "next/server";

import { createRequestLogContext, logStructured } from "@/lib/logging/structured";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";

export async function GET(request: Request) {
  const logContext = createRequestLogContext(request, "/auth/callback");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const nextPath =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/app";

  const redirectUrl = new URL(nextPath, url.origin);

  if (!code) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("error", "missing_code");
    redirectUrl.searchParams.set("next", nextPath);
    logStructured("warn", "auth_callback_missing_code", logContext);
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("error", "supabase_unavailable");
    redirectUrl.searchParams.set("next", nextPath);
    logStructured("error", "auth_callback_supabase_unavailable", logContext);
    return NextResponse.redirect(redirectUrl);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("error", "auth_callback_failed");
    redirectUrl.searchParams.set("next", nextPath);
    logStructured("warn", "auth_callback_exchange_failed", logContext, {
      error: error.message,
    });
    return NextResponse.redirect(redirectUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    logContext.user_id = user.id;
    await getTelemetrySystem()
      .emitEvent({
        event_type: "SIGNUP_COMPLETED",
        player_id: user.id,
        event_data: {
          source: "auth_callback",
          next_path: nextPath,
        },
      })
      .catch(() => null);

    logStructured("info", "auth_callback_completed", logContext, {
      next_path: nextPath,
    });
  }

  return NextResponse.redirect(redirectUrl);
}
