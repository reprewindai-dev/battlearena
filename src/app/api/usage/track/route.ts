import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { event_type, event_data } = await request.json();

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

    // Track usage
    const { error: insertError } = await supabase
      .from("usage_tracking")
      .insert({
        user_id: user.id,
        event_type,
        event_data: event_data || {},
      });

    if (insertError) {
      console.error("Usage tracking insert failed:", insertError);
      return NextResponse.json(
        { error: "Failed to track usage" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Usage tracking failed:", error);
    return NextResponse.json(
      { error: "Failed to track usage" },
      { status: 500 }
    );
  }
}
