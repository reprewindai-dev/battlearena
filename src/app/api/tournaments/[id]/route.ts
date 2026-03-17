import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type ParticipantRow = {
  id: string;
  status: string;
  seed_number: number | null;
  registered_at: string;
  user_id: string;
};

type UserRow = { id: string; username: string | null };
type UserProfileRow = { user_id: string; display_name: string | null; avatar_url: string | null; tier: string | null };
type UserRatingRow = { user_id: string; rating: number | null; tier: string | null };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: tournament, error } = await supabase.from("tournaments").select("*").eq("id", id).single();

  if (error || !tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const { data: participants } = await supabase
    .from("tournament_participants")
    .select(
      `
      id,
      status,
      seed_number,
      registered_at,
      user_id
    `,
    )
    .eq("tournament_id", id)
    .order("seed_number", { ascending: true, nullsFirst: false });

  const participantRows = (participants ?? []) as ParticipantRow[];
  const userIds = Array.from(new Set(participantRows.map((p) => p.user_id)));
  const [{ data: users }, { data: profiles }, { data: ratings }] = await Promise.all([
    userIds.length
      ? supabase.from("users").select("id,username").in("id", userIds)
      : Promise.resolve({ data: [] as UserRow[] }),
    userIds.length
      ? supabase.from("user_profiles").select("user_id,display_name,avatar_url,tier").in("user_id", userIds)
      : Promise.resolve({ data: [] as UserProfileRow[] }),
    userIds.length
      ? supabase.from("user_ratings").select("user_id,rating,tier").in("user_id", userIds)
      : Promise.resolve({ data: [] as UserRatingRow[] }),
  ]);
  const usersById = new Map<string, UserRow>(((users ?? []) as UserRow[]).map((u) => [u.id, u]));
  const profilesById = new Map<string, UserProfileRow>(((profiles ?? []) as UserProfileRow[]).map((u) => [u.user_id, u]));
  const ratingsById = new Map<string, UserRatingRow>(((ratings ?? []) as UserRatingRow[]).map((u) => [u.user_id, u]));

  const hydratedParticipants = participantRows.map((p) => {
    const user = usersById.get(p.user_id);
    const profile = profilesById.get(p.user_id);
    const rating = ratingsById.get(p.user_id);
    return {
      id: p.id,
      status: p.status,
      seed: p.seed_number,
      final_placement: null,
      registered_at: p.registered_at,
      user_profiles: [
        {
          id: p.user_id,
          handle: user?.username ?? p.user_id.slice(0, 8),
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          elo_rating: rating?.rating ?? 1000,
          tier: rating?.tier ?? profile?.tier ?? "bronze",
        },
      ],
    };
  });

  const participant_count = hydratedParticipants.filter(
    (p) => p.status === "confirmed" || p.status === "registered",
  ).length;

  return NextResponse.json({
    tournament: { ...tournament, participant_count },
    participants: hydratedParticipants,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = user.app_metadata?.role ?? "user";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const allowed = ["status", "name", "description", "registration_closes", "starts_at", "prize_structure", "ends_at"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase.from("tournaments").update(updates).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tournament: data });
}
