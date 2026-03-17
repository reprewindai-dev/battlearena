import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const CreateRoomSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(""),
  roomType: z.string().min(1).max(50),
  lobbyId: z.string().uuid().optional().nullable(),
  maxParticipants: z.number().int().min(2).max(250).optional().default(50),
  isPrivate: z.boolean().optional().default(false),
  tags: z.array(z.string().max(40)).max(20).optional().default([]),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
});

type RoomRow = {
  id: string;
  name: string;
  description: string | null;
  room_type: string | null;
  max_participants: number | null;
  room_code: string | null;
  is_private: boolean | null;
  tags: string[] | null;
  created_by: string | null;
  created_at: string | null;
};

type ParticipantRow = {
  room_id: string;
};

async function generateRoomCode(adminClient: ReturnType<typeof createSupabaseServiceRoleClient>): Promise<string> {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const { data, error } = await adminClient
      .from("rooms")
      .select("id")
      .eq("room_code", code)
      .maybeSingle();

    if (!error && !data) {
      return code;
    }
  }

  throw new Error("room_code_generation_failed");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const roomType = url.searchParams.get("type");
    const lobbyId = url.searchParams.get("lobby");
    const activeOnly = url.searchParams.get("active") === "true";
    const limitRaw = Number(url.searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 50;

    const adminClient = createSupabaseServiceRoleClient();

    let query = adminClient
      .from("rooms")
      .select("id,name,description,room_type,max_participants,room_code,is_private,tags,created_by,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (roomType) {
      query = query.eq("room_type", roomType);
    }

    if (lobbyId) {
      query = query.eq("lobby_id", lobbyId);
    }

    const { data: roomsRaw, error: roomsError } = await query;

    if (roomsError) {
      if (roomsError.message.includes("does not exist")) {
        return NextResponse.json({ ok: true, rooms: [] });
      }
      return NextResponse.json({ error: "fetch_failed", details: roomsError.message }, { status: 500 });
    }

    const rooms = (roomsRaw ?? []) as RoomRow[];
    const roomIds = rooms.map((room) => room.id);
    const creatorIds = Array.from(new Set(rooms.map((room) => room.created_by).filter((v): v is string => Boolean(v))));

    const [{ data: participantsRaw }, { data: creatorsRaw }] = await Promise.all([
      roomIds.length > 0
        ? adminClient.from("room_participants").select("room_id").in("room_id", roomIds)
        : Promise.resolve({ data: [] as ParticipantRow[] }),
      creatorIds.length > 0
        ? adminClient.from("user_profiles").select("id,handle,avatar_url").in("id", creatorIds)
        : Promise.resolve({ data: [] as Array<{ id: string; handle: string | null; avatar_url: string | null }> }),
    ]);

    const participantCounts = (participantsRaw ?? []).reduce((acc, row) => {
      const typed = row as ParticipantRow;
      acc.set(typed.room_id, (acc.get(typed.room_id) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    const creators = new Map<string, { id: string; username: string; avatar_url?: string }>();
    for (const row of creatorsRaw ?? []) {
      creators.set(row.id, {
        id: row.id,
        username: row.handle ?? `user_${row.id.slice(0, 8)}`,
        avatar_url: row.avatar_url ?? undefined,
      });
    }

    const mapped = rooms
      .map((room) => {
        const count = participantCounts.get(room.id) ?? 0;
        if (activeOnly && count < 1) {
          return null;
        }

        const creator = room.created_by ? creators.get(room.created_by) : undefined;

        return {
          id: room.id,
          name: room.name,
          description: room.description ?? "",
          room_type: room.room_type ?? "public",
          max_participants: room.max_participants ?? 50,
          current_participants: count,
          room_code: room.room_code ?? room.id.slice(0, 6).toUpperCase(),
          is_private: Boolean(room.is_private),
          tags: room.tags ?? [],
          creator: creator ?? {
            id: room.created_by ?? "unknown",
            username: room.created_by ? `user_${room.created_by.slice(0, 8)}` : "unknown",
          },
          _count: {
            room_participants: count,
          },
        };
      })
      .filter((room): room is NonNullable<typeof room> => room !== null);

    return NextResponse.json({ ok: true, rooms: mapped });
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
    const parsed = CreateRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
    }

    const adminClient = createSupabaseServiceRoleClient();
    const roomCode = await generateRoomCode(adminClient);

    const { data: room, error: roomError } = await adminClient
      .from("rooms")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description,
        room_type: parsed.data.roomType,
        max_participants: parsed.data.maxParticipants,
        is_private: parsed.data.isPrivate,
        room_code: roomCode,
        created_by: user.id,
        lobby_id: parsed.data.lobbyId ?? null,
        tags: parsed.data.tags,
        settings: parsed.data.settings,
        is_active: true,
      })
      .select("id,name,description,room_type,max_participants,room_code,is_private,tags,created_by,created_at")
      .single();

    if (roomError) {
      return NextResponse.json({ error: "room_creation_failed", details: roomError.message }, { status: 500 });
    }

    await adminClient
      .from("room_participants")
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: "host",
      })
      .throwOnError();

    return NextResponse.json({
      ok: true,
      room: {
        ...room,
        creator: {
          id: user.id,
          username: user.email?.split("@")[0] ?? `user_${user.id.slice(0, 8)}`,
        },
        _count: { room_participants: 1 },
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
