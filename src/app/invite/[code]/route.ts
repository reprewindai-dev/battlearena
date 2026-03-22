import { NextResponse } from "next/server";

import { recordReferralClickByCode } from "@/lib/growth/referrals";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const url = new URL(request.url);

  try {
    const adminClient = createSupabaseServiceRoleClient();
    await recordReferralClickByCode(adminClient, code).catch(() => null);
  } catch {
    // Non-fatal - continue redirect
  }

  const redirectUrl = new URL("/signup", url.origin);
  redirectUrl.searchParams.set("invite", code);
  return NextResponse.redirect(redirectUrl);
}
