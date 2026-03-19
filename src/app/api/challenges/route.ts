import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

type UserRow = { id: string; username: string | null };
type UserProfileRow = { user_id: string; display_name: string | null; avatar_url: string | null; tier: string | null };
type UserRatingRow = { user_id: string; rating: number | null; tier: string | null };

const CreateChallengeSchema = z
  .object({
    challenged_id: z.string().uuid(),
    battle_mode: z.enum(["freestyle", "ranked", "wager"]).default("freestyle"),
    wager_tokens: z.number().int().min(1).max(10000).nullable().optional(),
    message: z.string().trim().max(280).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.battle_mode === "wager" && !value.wager_tokens) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wager_tokens"],
        message: "wager_tokens_required_for_wager_mode",
      });
    }
    if (value.battle_mode !== "wager" && value.wager_tokens) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wager_tokens"],
        message: "wager_tokens_only_supported_for_wager_mode",
      });
    }
  });

// GET - list my challenges (incoming + outgoing)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const direction = searchParams.get("direction") ?? "incoming"; // incoming | outgoing

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensurePublicUserRecord(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "user_bootstrap_failed" }, { status: 400 });
  }

  const field = direction === "outgoing" ? "challenger_id" : "challenged_id";

  const { data, error } = await supabase
    .from("challenges")
    .select(`
      id, status, battle_mode, wager_tokens, message, expires_at, created_at,
      challenger_id,
      challenged_id
    `)
    .eq(field, user.id)
    .in("status", ["pending"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    status: string;
    battle_mode: string;
    wager_tokens: number | null;
    message: string | null;
    expires_at: string;
    created_at: string;
    challenger_id: string;
    challenged_id: string;
  }>;
  const userIds = Array.from(new Set(rows.flatMap((row: any) => [row.challenger_id, row.challenged_id])));
  const [{ data: users }, { data: profiles }, { data: ratings }] = await Promise.all([
    userIds.length ? supabase.from("users").select("id,username").in("id", userIds) : Promise.resolve({ data: [] as Array<{ id: string; username: string | null }> }),
    userIds.length ? supabase.from("user_profiles").select("user_id,display_name,avatar_url,tier").in("user_id", userIds) : Promise.resolve({ data: [] as Array<{ user_id: string; display_name: string | null; avatar_url: string | null; tier: string | null }> }),
    userIds.length ? supabase.from("user_ratings").select("user_id,rating,tier").in("user_id", userIds) : Promise.resolve({ data: [] as Array<{ user_id: string; rating: number | null; tier: string | null }> }),
  ]);

  const usersById = new Map<string, UserRow>(((users ?? []) as UserRow[]).map((row) => [row.id, row]));
  const profilesById = new Map<string, UserProfileRow>(((profiles ?? []) as UserProfileRow[]).map((row) => [row.user_id, row]));
  const ratingsById = new Map<string, UserRatingRow>(((ratings ?? []) as UserRatingRow[]).map((row) => [row.user_id, row]));

  const challenges = rows.map((row: any) => {
    const challengerUser = usersById.get(row.challenger_id);
    const challengedUser = usersById.get(row.challenged_id);
    const challengerProfile = profilesById.get(row.challenger_id);
    const challengedProfile = profilesById.get(row.challenged_id);
    const challengerRating = ratingsById.get(row.challenger_id);
    const challengedRating = ratingsById.get(row.challenged_id);
    return {
      id: row.id,
      status: row.status,
      battle_mode: row.battle_mode,
      wager_tokens: row.wager_tokens,
      message: row.message,
      expires_at: row.expires_at,
      created_at: row.created_at,
      challenger: {
        id: row.challenger_id,
        handle: challengerUser?.username ?? row.challenger_id.slice(0, 8),
        display_name: challengerProfile?.display_name ?? null,
        avatar_url: challengerProfile?.avatar_url ?? null,
        elo_rating: challengerRating?.rating ?? 1000,
        tier: challengerRating?.tier ?? challengerProfile?.tier ?? "bronze",
      },
      challenged: {
        id: row.challenged_id,
        handle: challengedUser?.username ?? row.challenged_id.slice(0, 8),
        display_name: challengedProfile?.display_name ?? null,
        avatar_url: challengedProfile?.avatar_url ?? null,
        elo_rating: challengedRating?.rating ?? 1000,
        tier: challengedRating?.tier ?? challengedProfile?.tier ?? "bronze",
      },
    };
  });

  return NextResponse.json({ challenges });
}

// POST - create challenge
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensurePublicUserRecord(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "user_bootstrap_failed" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateChallengeSchema.safeParse({
    challenged_id: (body as { challenged_id?: unknown }).challenged_id,
    battle_mode: (body as { battle_mode?: unknown }).battle_mode,
    wager_tokens:
      typeof (body as { wager_tokens?: unknown }).wager_tokens === "number"
        ? (body as { wager_tokens: number }).wager_tokens
        : null,
    message:
      typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message.trim()
        : null,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { challenged_id, battle_mode, wager_tokens, message } = parsed.data;

  if (challenged_id === user.id) {
    return NextResponse.json({ error: "Cannot challenge yourself" }, { status: 400 });
  }

  const { data: challengedUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", challenged_id)
    .maybeSingle();
  if (!challengedUser) {
    return NextResponse.json({ error: "challenged_user_not_found" }, { status: 404 });
  }

  // Check for existing pending challenge
  const { data: existing } = await supabase
    .from("challenges")
    .select("id")
    .eq("challenger_id", user.id)
    .eq("challenged_id", challenged_id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Challenge already pending" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      challenger_id: user.id,
      challenged_id,
      battle_mode,
      wager_tokens: wager_tokens ?? null,
      message: message ? String(message).slice(0, 280) : null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify challenged user
  await supabase.from("notifications").insert({
    user_id: challenged_id,
    type: "challenge",
    title: "You've been challenged!",
    body: message ? String(message).slice(0, 100) : "Someone challenged you to a battle.",
    actor_id: user.id,
    link: `/app/challenges`,
  });

  return NextResponse.json({ challenge: data }, { status: 201 });
}

