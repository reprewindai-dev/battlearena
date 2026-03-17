import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const [{ data: userRow, error: userError }, { data: profileRow }, { data: ratingRow }] = await Promise.all([
    supabase.from("users").select("id,username,is_verified,is_banned,created_at").eq("id", userId).maybeSingle(),
    supabase.from("user_profiles").select("display_name,bio,avatar_url,tier,battle_stats,reputation_score").eq("user_id", userId).maybeSingle(),
    supabase.from("user_ratings").select("rating,tier,wins,losses").eq("user_id", userId).maybeSingle(),
  ]);

  if (userError || !userRow || userRow.is_banned) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: recentParticipantRows } = await supabase
    .from("battle_participants")
    .select("battle_id,user_id,slot,score")
    .eq("user_id", userId)
    .limit(20);
  const battleIds = Array.from(new Set((recentParticipantRows ?? []).map((row) => row.battle_id)));
  const { data: battles } = battleIds.length
    ? await supabase
        .from("battles")
        .select("id,status,mode,created_at,winner_id,participant_1_id,participant_2_id")
        .in("id", battleIds)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] as Array<Record<string, unknown>> };

  return NextResponse.json({
    profile: {
      id: userRow.id,
      handle: userRow.username,
      display_name: profileRow?.display_name ?? null,
      bio: profileRow?.bio ?? null,
      avatar_url: profileRow?.avatar_url ?? null,
      is_verified: Boolean(userRow.is_verified),
      elo_rating: ratingRow?.rating ?? 1000,
      tier: ratingRow?.tier ?? profileRow?.tier ?? "bronze",
      wins: ratingRow?.wins ?? 0,
      losses: ratingRow?.losses ?? 0,
      created_at: userRow.created_at,
    },
    achievements: [],
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

  const body = (await req.json().catch(() => ({} as Record<string, unknown>))) as Record<string, unknown>;
  const allowed = ["handle", "display_name", "bio", "avatar_url"] as const;
  type AllowedField = typeof allowed[number];
  const update: Partial<Record<AllowedField, string>> = {};

  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = String(body[key]).slice(0, 500);
  }

  if (update.handle) {
    // Validate handle: alphanumeric + underscore, 3-30 chars
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(update.handle)) {
      return NextResponse.json({ error: "Invalid handle format" }, { status: 400 });
    }
  }

  if (update.handle) {
    const { error: handleError } = await supabase
      .from("users")
      .update({ username: update.handle.toLowerCase() })
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
        display_name: update.display_name ?? null,
        bio: update.bio ?? null,
        avatar_url: update.avatar_url ?? null,
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
