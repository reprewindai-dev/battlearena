import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("supabase_service_config_missing");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const roomType = searchParams.get("type");
    const lobbyId = searchParams.get("lobby");
    const active = searchParams.get("active");
    const limit = parseInt(searchParams.get("limit") || "50");

    const adminClient = await getServiceClient();

    let query = adminClient
      .from("rooms")
      .select(`
        *,
        creator:users!rooms_created_by_fkey(id, username, avatar_url),
        participants:room_participants(count),
        _count: {
          room_participants: room_participants(count)
        }
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (roomType) {
      query = query.eq("room_type", roomType);
    }

    if (active === "true") {
      query = query.gte("current_participants", 1);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "fetch_failed", details: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, rooms: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: "unknown_error", details: error.message ?? "" }, { status: 500 });
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
    const { name, description, roomType, maxParticipants, isPrivate, tags, settings } = body;

    if (!name || !roomType) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const adminClient = await getServiceClient();

    // Generate unique room code
    const roomCode = await generateRoomCode(adminClient);

    const { data: room, error: roomError } = await adminClient
      .from("rooms")
      .insert({
        name,
        description: description || "",
        room_type: roomType,
        max_participants: maxParticipants || 50,
        is_private: isPrivate || false,
        room_code: roomCode,
        created_by: user.id,
        tags: tags || [],
        settings: settings || {},
      })
      .select(`
        *,
        creator:users!rooms_created_by_fkey(id, username, avatar_url)
      `)
      .single();

    if (roomError) {
      return NextResponse.json({ error: "room_creation_failed", details: roomError.message }, { status: 500 });
    }

    // Add creator as host participant
    await adminClient
      .from("room_participants")
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: "host",
      });

    return NextResponse.json({ ok: true, room });
  } catch (error: any) {
    return NextResponse.json({ error: "unknown_error", details: error.message ?? "" }, { status: 500 });
  }
}

async function generateRoomCode(client: any): Promise<string> {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code: string;
  let attempts = 0;
  
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    const { data } = await client
      .from("rooms")
      .select("room_code")
      .eq("room_code", code)
      .single();
    
    attempts++;
    if (attempts > 10) break;
  } while (data);
  
  return code;
}
