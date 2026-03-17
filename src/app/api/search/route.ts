import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type") ?? "users"; // users | battles
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  if (type === "users") {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, handle, display_name, avatar_url, elo_rating, tier, is_verified, wins, losses, total_battles")
      .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
      .eq("is_banned", false)
      .order("elo_rating", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ results: data ?? [], query: q, type });
  }

  if (type === "battles") {
    const { data, error } = await supabase
      .from("battles")
      .select("id, status, mode, created_at")
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ results: data ?? [], query: q, type });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
