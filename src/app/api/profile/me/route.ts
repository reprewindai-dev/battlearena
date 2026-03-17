import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

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

  const [{ data: userRow }, { data: profileRow }, { data: ratingRow }, { data: pendingChallenges }] =
    await Promise.all([
      supabase.from("users").select("id,username,is_verified").eq("id", user.id).maybeSingle(),
      supabase
        .from("user_profiles")
        .select("display_name,bio,avatar_url,tier")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_ratings")
        .select("rating,tier,wins,losses")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("challenges")
        .select("id,challenger_id,battle_mode,message,created_at")
        .eq("challenged_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString()),
    ]);

  return NextResponse.json({
    profile: {
      id: user.id,
      handle: userRow?.username ?? user.id.slice(0, 8),
      display_name: profileRow?.display_name ?? null,
      bio: profileRow?.bio ?? null,
      avatar_url: profileRow?.avatar_url ?? null,
      is_verified: Boolean(userRow?.is_verified),
      elo_rating: ratingRow?.rating ?? 1000,
      tier: ratingRow?.tier ?? profileRow?.tier ?? "bronze",
      wins: ratingRow?.wins ?? 0,
      losses: ratingRow?.losses ?? 0,
    },
    achievements: [],
    pending_challenges: pendingChallenges ?? [],
  });
}

export async function PATCH(req: NextRequest) {
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

  try {
    await ensurePublicUserRecord(supabase, user);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "user_bootstrap_failed" },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({} as Record<string, unknown>))) as Record<string, unknown>;
  const handle = typeof body.handle === "string" ? body.handle.trim().toLowerCase() : null;
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : null;
  const bio = typeof body.bio === "string" ? body.bio.trim() : null;
  const avatarUrl = typeof body.avatar_url === "string" ? body.avatar_url.trim() : null;

  if (handle && !/^[a-zA-Z0-9_]{3,30}$/.test(handle)) {
    return NextResponse.json(
      { error: "Handle must be 3-30 chars, alphanumeric + underscore" },
      { status: 400 },
    );
  }

  if (handle) {
    const { error: handleError } = await supabase.from("users").update({ username: handle }).eq("id", user.id);
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
        user_id: user.id,
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
