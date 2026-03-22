import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getHydratedProfile } from "@/lib/community/profile";
import { createRequestLogContext, logStructured, withRequestId } from "@/lib/logging/structured";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTelemetrySystem } from "@/lib/telemetry/runtime";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

const UpdateOwnProfileSchema = z.object({
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/).optional(),
  display_name: z.string().trim().max(80).nullable().optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  avatar_url: z.string().trim().url().max(500).nullable().optional(),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensurePublicUserRecord(supabase, user).catch(() => null);

  const [hydratedProfile, { data: pendingChallenges }] = await Promise.all([
    getHydratedProfile(supabase, user.id),
    supabase
      .from("challenges")
      .select("id,challenger_id,battle_mode,message,created_at")
      .eq("challenged_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
  ]);

  if (!hydratedProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: hydratedProfile.profile,
    achievements: hydratedProfile.achievements,
    pending_challenges: pendingChallenges ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  const logContext = createRequestLogContext(req, "/api/profile/me");
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    logStructured("error", "profile_patch_supabase_unavailable", logContext);
    return withRequestId(NextResponse.json({ error: "Service unavailable" }, { status: 503 }), logContext.request_id);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    logStructured("warn", "profile_patch_unauthorized", logContext);
    return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), logContext.request_id);
  }
  logContext.user_id = user.id;

  try {
    await ensurePublicUserRecord(supabase, user);
  } catch (error) {
    logStructured("warn", "profile_patch_user_bootstrap_failed", logContext, {
      error: error instanceof Error ? error.message : "user_bootstrap_failed",
    });
    return withRequestId(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "user_bootstrap_failed" },
        { status: 400 },
      ),
      logContext.request_id,
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateOwnProfileSchema.safeParse({
    handle:
      typeof (body as { handle?: unknown }).handle === "string"
        ? (body as { handle: string }).handle.trim().toLowerCase()
        : undefined,
    display_name:
      typeof (body as { display_name?: unknown }).display_name === "string"
        ? (body as { display_name: string }).display_name.trim()
        : (body as { display_name?: null }).display_name === null
          ? null
          : undefined,
    bio:
      typeof (body as { bio?: unknown }).bio === "string"
        ? (body as { bio: string }).bio.trim()
        : (body as { bio?: null }).bio === null
          ? null
          : undefined,
    avatar_url:
      typeof (body as { avatar_url?: unknown }).avatar_url === "string"
        ? (body as { avatar_url: string }).avatar_url.trim()
        : (body as { avatar_url?: null }).avatar_url === null
          ? null
          : undefined,
  });

  if (!parsed.success) {
    logStructured("warn", "profile_patch_invalid_request", logContext, {
      validation_error: parsed.error.flatten(),
    });
    return withRequestId(
      NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 }),
      logContext.request_id,
    );
  }

  if (parsed.data.handle) {
    const { error: handleError } = await supabase.from("users").update({ username: parsed.data.handle }).eq("id", user.id);
    if (handleError) {
      if (handleError.code === "23505") {
        return withRequestId(NextResponse.json({ error: "Handle already taken" }, { status: 409 }), logContext.request_id);
      }
      logStructured("error", "profile_patch_handle_update_failed", logContext, {
        error: handleError.message,
      });
      return withRequestId(NextResponse.json({ error: handleError.message }, { status: 500 }), logContext.request_id);
    }
  }

  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: parsed.data.display_name ?? null,
        bio: parsed.data.bio ?? null,
        avatar_url: parsed.data.avatar_url ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("user_id")
    .single();

  if (error) {
    logStructured("error", "profile_patch_upsert_failed", logContext, {
      error: error.message,
    });
    return withRequestId(NextResponse.json({ error: error.message }, { status: 500 }), logContext.request_id);
  }

  const hydratedProfile = await getHydratedProfile(supabase, user.id);
  if (!hydratedProfile) {
    return withRequestId(NextResponse.json({ error: "profile_not_found_after_update" }, { status: 500 }), logContext.request_id);
  }

  await getTelemetrySystem()
    .emitEvent({
      event_type: "PROFILE_COMPLETED",
      player_id: user.id,
      event_data: {
        handle_updated: Boolean(parsed.data.handle),
        display_name_updated: parsed.data.display_name !== undefined,
        avatar_updated: parsed.data.avatar_url !== undefined,
        bio_updated: parsed.data.bio !== undefined,
      },
    })
    .catch(() => null);

  logStructured("info", "profile_updated", logContext, {
    handle_updated: Boolean(parsed.data.handle),
    display_name_updated: parsed.data.display_name !== undefined,
    avatar_updated: parsed.data.avatar_url !== undefined,
    bio_updated: parsed.data.bio !== undefined,
  });

  return withRequestId(NextResponse.json({ profile: hydratedProfile.profile }), logContext.request_id);
}
