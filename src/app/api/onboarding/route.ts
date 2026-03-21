import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { getOnboardingState } from "@/lib/onboarding/progress";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

const ActionSchema = z.object({
  action: z.enum(["dismiss", "reopen", "view"]),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const adminClient = createSupabaseServiceRoleClient();
  await ensurePublicUserRecord(adminClient, user);
  const onboarding = await getOnboardingState(adminClient, user.id);
  return NextResponse.json({ onboarding });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const adminClient = createSupabaseServiceRoleClient();
  await ensurePublicUserRecord(adminClient, user);

  const now = new Date().toISOString();
  const patch =
    parsed.data.action === "dismiss"
      ? { dismissed_at: now, last_viewed_at: now, updated_at: now }
      : parsed.data.action === "reopen"
        ? { dismissed_at: null, last_viewed_at: now, updated_at: now }
        : { last_viewed_at: now, updated_at: now };

  const { error } = await adminClient.from("user_onboarding_progress").upsert(
    {
      user_id: user.id,
      ...patch,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const onboarding = await getOnboardingState(adminClient, user.id);
  return NextResponse.json({ onboarding });
}
