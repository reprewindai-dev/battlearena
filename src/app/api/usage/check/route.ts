import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { event_type } = await request.json();

    if (!event_type) {
      return NextResponse.json({ error: "Event type required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const headersList = await headers();
    const authHeader = headersList.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get user's subscription tier
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ allowed: false, reason: "Profile not found" });
    }

    // Enterprise has unlimited access
    if (profile.subscription_tier === "enterprise") {
      return NextResponse.json({ allowed: true });
    }

    // Pro has access to most features
    if (profile.subscription_tier === "pro") {
      if (event_type === "tournament_created") {
        return NextResponse.json({ allowed: false, reason: "Tournaments require Enterprise plan" });
      }
      return NextResponse.json({ allowed: true });
    }

    // Free tier limitations
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfNextMonth = new Date(startOfMonth);
    startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1);
    
    if (event_type === "battle_created") {
      const { data: usage } = await supabase
        .from("usage_tracking")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_type", "battle_created")
        .gte("created_at", startOfMonth.toISOString())
        .lt("created_at", startOfNextMonth.toISOString());

      const battleCount = usage?.length || 0;
      return NextResponse.json({
        allowed: battleCount < 3,
        reason: battleCount >= 3 ? "Battle limit exceeded for free tier" : null,
        current: battleCount,
        limit: 3,
      });
    }

    if (event_type === "api_call") {
      const { data: usage } = await supabase
        .from("usage_tracking")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_type", "api_call")
        .gte("created_at", startOfMonth.toISOString())
        .lt("created_at", startOfNextMonth.toISOString());

      const apiCount = usage?.length || 0;
      return NextResponse.json({
        allowed: apiCount < 1000,
        reason: apiCount >= 1000 ? "API limit exceeded for free tier" : null,
        current: apiCount,
        limit: 1000,
      });
    }

    if (event_type === "video_session") {
      return NextResponse.json({
        allowed: false,
        reason: "Video sessions require Pro plan",
      });
    }

    if (event_type === "tournament_created") {
      return NextResponse.json({
        allowed: false,
        reason: "Tournaments require Enterprise plan",
      });
    }

    return NextResponse.json({ allowed: true });
  } catch (error) {
    console.error("Usage check failed:", error);
    return NextResponse.json(
      { error: "Failed to check usage" },
      { status: 500 }
    );
  }
}
