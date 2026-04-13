import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const markNotificationsReadSchema = z.union([
  z.object({
    all: z.literal(true),
  }),
  z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    all: z.literal(false).optional(),
  }),
]);

// Mark notifications as read
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = markNotificationsReadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date().toISOString();

  if ("all" in parsed.data && parsed.data.all === true) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, marked: "all" });
  }

  if ("ids" in parsed.data) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .in("id", parsed.data.ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, marked: parsed.data.ids.length });
  }
  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}
