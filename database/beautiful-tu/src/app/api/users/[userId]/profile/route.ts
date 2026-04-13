import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getHydratedProfile } from "@/lib/community/profile";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

const UpdateProfileSchema = z.object({
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/).optional(),
  display_name: z.string().trim().max(80).nullable().optional(),
  bio: z.string().trim().max(280).nullable().optional(),
  avatar_url: z.string().trim().url().max(500).nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const hydratedProfile = await getHydratedProfile(supabase, userId);
  if (!hydratedProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: recentParticipantRows } = await supabase
    .from("battle_participants")
    .select("battle_id,user_id,slot,score")
    .eq("user_id", userId)
    .limit(20);
  const battleIds = Array.from(new Set((recentParticipantRows ?? []).map((row: any) => row.battle_id)));
  const { data: battles } = battleIds.length
    ? await supabase
        .from("battles")
        .select("id,status,mode,created_at,winner_id,participant_1_id,participant_2_id")
        .in("id", battleIds)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] as Array<Record<string, unknown>> };

  return NextResponse.json({
    profile: hydratedProfile.profile,
    achievements: hydratedProfile.achievements,
    recent_battles: battles ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensurePublicUserRecord(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "user_bootstrap_failed" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateProfileSchema.safeParse({
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
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.handle) {
    const { error: handleError } = await supabase
      .from("users")
      .update({ username: parsed.data.handle })
      .eq("id", userId);
    if (handleError) {
      if (handleError.code === "23505") {
        return NextResponse.json({ error: "Handle already taken" }, { status: 409 });
      }
      return NextResponse.json({ error: handleError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hydratedProfile = await getHydratedProfile(supabase, userId);
  if (!hydratedProfile) {
    return NextResponse.json({ error: "profile_not_found_after_update" }, { status: 500 });
  }

  return NextResponse.json({ profile: hydratedProfile.profile });
}

