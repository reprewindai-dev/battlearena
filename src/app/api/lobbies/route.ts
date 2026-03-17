import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const CreateLobbySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(""),
  lobbyType: z.string().min(1).max(50),
  maxRooms: z.number().int().min(1).max(500).optional().default(50),
  maxUsersPerRoom: z.number().int().min(2).max(250).optional().default(10),
  isFeatured: z.boolean().optional().default(false),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
});

type LobbyRow = {
  id: string;
  name: string;
  description: string | null;
  lobby_type: string | null;
  max_rooms: number | null;
  max_users_per_room: number | null;
  is_featured: boolean | null;
  created_by: string | null;
  created_at: string | null;
};

type RoomCountRow = {
  lobby_id: string;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lobbyType = url.searchParams.get("type");
    const featuredOnly = url.searchParams.get("featured") === "true";

    const adminClient = createSupabaseServiceRoleClient();

    let query = adminClient
      .from("lobbies")
      .select("id,name,description,lobby_type,max_rooms,max_users_per_room,is_featured,created_by,created_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (lobbyType) {
      query = query.eq("lobby_type", lobbyType);
    }

    if (featuredOnly) {
      query = query.eq("is_featured", true);
    }

    const { data: lobbiesRaw, error: lobbiesError } = await query;

    if (lobbiesError) {
      if (lobbiesError.message.includes("does not exist")) {
        return NextResponse.json({ ok: true, lobbies: [] });
      }
      return NextResponse.json({ error: "fetch_failed", details: lobbiesError.message }, { status: 500 });
    }

    const lobbies = (lobbiesRaw ?? []) as LobbyRow[];
    const lobbyIds = lobbies.map((lobby) => lobby.id);

    const { data: roomsRaw } = lobbyIds.length
      ? await adminClient.from("rooms").select("lobby_id").in("lobby_id", lobbyIds)
      : { data: [] as RoomCountRow[] };

    const roomCounts = (roomsRaw ?? []).reduce((acc, row) => {
      const typed = row as RoomCountRow;
      acc.set(typed.lobby_id, (acc.get(typed.lobby_id) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    const mapped = lobbies.map((lobby) => ({
      id: lobby.id,
      name: lobby.name,
      description: lobby.description ?? "",
      lobby_type: lobby.lobby_type ?? "general",
      max_rooms: lobby.max_rooms ?? 50,
      current_rooms: roomCounts.get(lobby.id) ?? 0,
      max_users_per_room: lobby.max_users_per_room ?? 10,
      is_featured: Boolean(lobby.is_featured),
      rooms: [],
    }));

    return NextResponse.json({ ok: true, lobbies: mapped });
  } catch (error) {
    return NextResponse.json(
      {
        error: "unknown_error",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = CreateLobbySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
    }

    const adminClient = createSupabaseServiceRoleClient();

    const { data: lobby, error: lobbyError } = await adminClient
      .from("lobbies")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description,
        lobby_type: parsed.data.lobbyType,
        max_rooms: parsed.data.maxRooms,
        max_users_per_room: parsed.data.maxUsersPerRoom,
        is_featured: parsed.data.isFeatured,
        created_by: user.id,
        settings: parsed.data.settings,
        is_active: true,
      })
      .select("id,name,description,lobby_type,max_rooms,max_users_per_room,is_featured")
      .single();

    if (lobbyError) {
      return NextResponse.json({ error: "lobby_creation_failed", details: lobbyError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      lobby: {
        ...lobby,
        current_rooms: 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "unknown_error",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
