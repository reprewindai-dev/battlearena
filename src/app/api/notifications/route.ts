import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
  const offset = Number(searchParams.get("offset") ?? "0");
  const unreadOnly = searchParams.get("unread") === "true";

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = supabase
    .from("notifications")
    .select(`
      id, type, title, body, link, read_at, created_at, actor_id
    `, { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Count unread
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  const rows = (data ?? []) as Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    read_at: string | null;
    created_at: string;
    actor_id: string | null;
  }>;
  const actorIds = Array.from(new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id))));
  const [{ data: users }, { data: profiles }] = await Promise.all([
    actorIds.length ? supabase.from("users").select("id,username").in("id", actorIds) : Promise.resolve({ data: [] as Array<{ id: string; username: string | null }> }),
    actorIds.length ? supabase.from("user_profiles").select("user_id,display_name,avatar_url").in("user_id", actorIds) : Promise.resolve({ data: [] as Array<{ user_id: string; display_name: string | null; avatar_url: string | null }> }),
  ]);
  const usersById = new Map((users ?? []).map((row) => [row.id, row]));
  const profilesById = new Map((profiles ?? []).map((row) => [row.user_id, row]));

  return NextResponse.json({
    notifications: rows.map((row) => {
      if (!row.actor_id) {
        return { ...row, actor: null };
      }
      const actorUser = usersById.get(row.actor_id);
      const actorProfile = profilesById.get(row.actor_id);
      return {
        ...row,
        actor: {
          id: row.actor_id,
          handle: actorUser?.username ?? row.actor_id.slice(0, 8),
          display_name: actorProfile?.display_name ?? null,
          avatar_url: actorProfile?.avatar_url ?? null,
        },
      };
    }),
    total: count ?? 0,
    unread_count: unreadCount ?? 0,
  });
}
