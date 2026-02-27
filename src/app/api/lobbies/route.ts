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
    const lobbyType = searchParams.get("type");
    const featured = searchParams.get("featured");
    const active = searchParams.get("active");

    const adminClient = await getServiceClient();

    let query = adminClient
      .from("lobbies")
      .select(`
        *,
        creator:users!lobbies_created_by_fkey(id, username, avatar_url),
        rooms:rooms(count)
      `)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (lobbyType) {
      query = query.eq("lobby_type", lobbyType);
    }

    if (featured === "true") {
      query = query.eq("is_featured", true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "fetch_failed", details: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, lobbies: data || [] });
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
    const { name, description, lobbyType, maxRooms, maxUsersPerRoom, isFeatured, settings } = body;

    if (!name || !lobbyType) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const adminClient = await getServiceClient();

    const { data: lobby, error: lobbyError } = await adminClient
      .from("lobbies")
      .insert({
        name,
        description: description || "",
        lobby_type: lobbyType,
        max_rooms: maxRooms || 50,
        max_users_per_room: maxUsersPerRoom || 10,
        is_featured: isFeatured || false,
        created_by: user.id,
        settings: settings || {},
      })
      .select(`
        *,
        creator:users!lobbies_created_by_fkey(id, username, avatar_url)
      `)
      .single();

    if (lobbyError) {
      return NextResponse.json({ error: "lobby_creation_failed", details: lobbyError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, lobby });
  } catch (error: any) {
    return NextResponse.json({ error: "unknown_error", details: error.message ?? "" }, { status: 500 });
  }
}
