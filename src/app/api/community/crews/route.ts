import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

type CrewRow = {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  leader_id: string;
  created_at: string;
  member_count: number;
  crew_level: number;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCrewTag(baseName: string, attempt = 0) {
  const base = slugify(baseName).replace(/-/g, "").slice(0, 4);
  const entropy = `${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 3).toString(36).padStart(3, "0")}`
    .slice(-5);
  return `${base || "crew"}${attempt > 0 ? `${attempt}` : ""}${entropy}`.slice(0, 10);
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 30);

  const { data, error } = await supabase
    .from("crews")
    .select("id,name,tag,description,leader_id,created_at,member_count,crew_level")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const crews = (data ?? []) as CrewRow[];
  const crewIds = crews.map((c) => c.id);

  const [{ data: memberships }, { data: counts }] = await Promise.all([
    user && crewIds.length > 0
      ? supabase
          .from("crew_members")
          .select("crew_id,role")
          .eq("user_id", user.id)
          .in("crew_id", crewIds)
      : Promise.resolve({ data: [] as Array<{ crew_id: string; role: string | null }> }),
    crewIds.length > 0
      ? supabase.from("crew_members").select("crew_id").in("crew_id", crewIds)
      : Promise.resolve({ data: [] as Array<{ crew_id: string }> }),
  ]);

  const memberByCrew = new Map<string, { isMember: boolean; role: string | null }>();
  for (const row of memberships ?? []) {
    memberByCrew.set((row as { crew_id: string }).crew_id, {
      isMember: true,
      role: (row as { role?: string | null }).role ?? null,
    });
  }

  const countsByCrew = new Map<string, number>();
  for (const row of counts ?? []) {
    const crewId = (row as { crew_id: string }).crew_id;
    countsByCrew.set(crewId, (countsByCrew.get(crewId) ?? 0) + 1);
  }

  return NextResponse.json({
    items: crews.map((crew) => {
      const memberMeta = memberByCrew.get(crew.id);
      return {
        ...crew,
        member_count: countsByCrew.get(crew.id) ?? crew.member_count ?? 0,
        is_member: memberMeta?.isMember ?? false,
        member_role: memberMeta?.role ?? null,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
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
  const name = String(body.name ?? "").trim();
  const description = typeof body.description === "string" ? body.description.trim() : null;

  if (name.length < 3 || name.length > 64) {
    return NextResponse.json({ error: "name_must_be_3_to_64_chars" }, { status: 400 });
  }

  let crew: CrewRow | null = null;
  let createError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const tag = buildCrewTag(name, attempt);
    const response = await supabase
      .from("crews")
      .insert({
        name,
        tag,
        description,
        leader_id: user.id,
        member_count: 1,
      })
      .select("id,name,tag,description,leader_id,created_at,member_count,crew_level")
      .single();

    if (!response.error && response.data) {
      crew = response.data as CrewRow;
      createError = null;
      break;
    }

    createError = response.error ? { message: response.error.message, code: response.error.code } : null;
    if (createError?.code !== "23505") {
      break;
    }
  }

  if (createError || !crew) {
    return NextResponse.json({ error: createError?.message ?? "crew_create_failed" }, { status: 400 });
  }

  const { error: memberError } = await supabase.from("crew_members").insert({
    crew_id: crew.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  return NextResponse.json({ item: crew }, { status: 201 });
}
