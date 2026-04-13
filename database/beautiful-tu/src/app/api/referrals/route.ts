import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { getOrCreateReferralInvite, getReferralStatsForUser } from "@/lib/growth/referrals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

function buildInviteLink(origin: string, code: string) {
  return `${origin}/invite/${code}`;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  await ensurePublicUserRecord(supabase, user);
  const primaryInvite = await getOrCreateReferralInvite(supabase, user.id);
  const invites = await getReferralStatsForUser(supabase, user.id);
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    ok: true,
    primary: {
      ...primaryInvite,
      inviteLink: buildInviteLink(origin, primaryInvite.code),
    },
    invites: invites.map((invite) => ({
      ...invite,
      inviteLink: buildInviteLink(origin, invite.code),
    })),
    totals: {
      clicks: invites.reduce((sum, invite) => sum + invite.clicks, 0),
      signups: invites.reduce((sum, invite) => sum + invite.signups, 0),
      activations: invites.reduce((sum, invite) => sum + invite.activations, 0),
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  await ensurePublicUserRecord(supabase, user);
  const body = await request.json().catch(() => ({}));
  const label =
    typeof body.label === "string" && body.label.trim().length > 0
      ? body.label.trim().slice(0, 80)
      : "Primary invite";
  const invite = await getOrCreateReferralInvite(supabase, user.id, label);
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    ok: true,
    invite: {
      ...invite,
      inviteLink: buildInviteLink(origin, invite.code),
    },
  });
}
