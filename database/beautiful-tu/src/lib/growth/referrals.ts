import { randomBytes } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

type ReferralInviteRow = {
  id: string;
  inviter_user_id: string;
  code: string;
  label: string | null;
  clicks: number;
  signups: number;
  activations: number;
};

type ReferralLinkStats = {
  inviteId: string;
  code: string;
  label: string | null;
  clicks: number;
  signups: number;
  activations: number;
};

function generateReferralCode() {
  return randomBytes(5).toString("hex");
}

export async function getReferralStatsForUser(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("referral_invites")
    .select("id,inviter_user_id,code,label,clicks,signups,activations")
    .eq("inviter_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`referral_invites_lookup_failed:${error.message}`);
  }

  return ((data ?? []) as ReferralInviteRow[]).map(
    (row): ReferralLinkStats => ({
      inviteId: row.id,
      code: row.code,
      label: row.label,
      clicks: row.clicks,
      signups: row.signups,
      activations: row.activations,
    }),
  );
}

export async function getOrCreateReferralInvite(client: SupabaseClient, userId: string, label = "Primary invite") {
  const existing = await getReferralStatsForUser(client, userId);
  if (existing.length > 0) {
    return existing[0];
  }

  const code = generateReferralCode();
  const { data, error } = await client
    .from("referral_invites")
    .insert({
      inviter_user_id: userId,
      code,
      label,
    })
    .select("id,inviter_user_id,code,label,clicks,signups,activations")
    .single();

  if (error || !data) {
    throw new Error(`referral_invite_create_failed:${error?.message ?? "unknown_error"}`);
  }

  const row = data as ReferralInviteRow;
  return {
    inviteId: row.id,
    code: row.code,
    label: row.label,
    clicks: row.clicks,
    signups: row.signups,
    activations: row.activations,
  } satisfies ReferralLinkStats;
}

export async function recordReferralClickByCode(client: SupabaseClient, code: string) {
  const { data, error } = await client
    .from("referral_invites")
    .select("id,clicks")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    throw new Error(`referral_click_lookup_failed:${error.message}`);
  }
  if (!data) {
    return { ok: false, reason: "not_found" as const };
  }

  const { error: updateError } = await client
    .from("referral_invites")
    .update({
      clicks: Number(data.clicks ?? 0) + 1,
      last_clicked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);

  if (updateError) {
    throw new Error(`referral_click_update_failed:${updateError.message}`);
  }

  return { ok: true };
}

export async function recordReferralSignup(client: SupabaseClient, referredUserId: string, referralCode: string) {
  const normalizedCode = referralCode.trim().toLowerCase();
  if (!normalizedCode) {
    return { ok: false, reason: "missing_code" as const };
  }

  const { data: invite, error: inviteError } = await client
    .from("referral_invites")
    .select("id,inviter_user_id,signups")
    .eq("code", normalizedCode)
    .maybeSingle();

  if (inviteError) {
    throw new Error(`referral_invite_lookup_failed:${inviteError.message}`);
  }
  if (!invite) {
    return { ok: false, reason: "invite_not_found" as const };
  }
  if (invite.inviter_user_id === referredUserId) {
    return { ok: false, reason: "self_referral" as const };
  }

  const { data: existing, error: existingError } = await client
    .from("user_referrals")
    .select("id")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`referral_existing_lookup_failed:${existingError.message}`);
  }
  if (existing) {
    return { ok: true, idempotent: true };
  }

  const { error: insertError } = await client.from("user_referrals").insert({
    invite_id: invite.id,
    inviter_user_id: invite.inviter_user_id,
    referred_user_id: referredUserId,
    status: "signed_up",
  });

  if (insertError) {
    throw new Error(`referral_signup_insert_failed:${insertError.message}`);
  }

  const { error: updateError } = await client
    .from("referral_invites")
    .update({
      signups: Number(invite.signups ?? 0) + 1,
      last_signup_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (updateError) {
    throw new Error(`referral_signup_counter_failed:${updateError.message}`);
  }

  return { ok: true, idempotent: false, inviterUserId: invite.inviter_user_id };
}

export async function markReferralActivated(client: SupabaseClient, referredUserId: string, activationEvent: string) {
  const { data: referral, error: referralError } = await client
    .from("user_referrals")
    .select("id,invite_id,status")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();

  if (referralError) {
    throw new Error(`referral_activation_lookup_failed:${referralError.message}`);
  }
  if (!referral) {
    return { ok: false, reason: "not_referred" as const };
  }
  if (referral.status === "activated") {
    return { ok: true, idempotent: true };
  }

  const { error: referralUpdateError } = await client
    .from("user_referrals")
    .update({
      status: "activated",
      activation_event: activationEvent,
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", referral.id);

  if (referralUpdateError) {
    throw new Error(`referral_activation_update_failed:${referralUpdateError.message}`);
  }

  const { data: invite, error: inviteError } = await client
    .from("referral_invites")
    .select("id,activations")
    .eq("id", referral.invite_id)
    .maybeSingle();

  if (inviteError) {
    throw new Error(`referral_activation_invite_lookup_failed:${inviteError.message}`);
  }
  if (invite) {
    const { error: inviteUpdateError } = await client
      .from("referral_invites")
      .update({
        activations: Number(invite.activations ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    if (inviteUpdateError) {
      throw new Error(`referral_activation_counter_failed:${inviteUpdateError.message}`);
    }
  }

  return { ok: true, idempotent: false };
}
