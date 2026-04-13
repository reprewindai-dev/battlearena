import type { SupabaseClient } from "@supabase/supabase-js";

import { sendSystemNotification } from "@/lib/notifications/system";

export type OnboardingStep = {
  id: "profile" | "funding" | "battle" | "community";
  title: string;
  description: string;
  href: string;
  complete: boolean;
};

export type OnboardingState = {
  dismissed: boolean;
  completed: boolean;
  completedSteps: number;
  totalSteps: number;
  steps: OnboardingStep[];
};

type ProgressRow = {
  user_id: string;
  welcome_notification_sent_at: string | null;
  dismissed_at: string | null;
  completed_at: string | null;
  last_viewed_at: string | null;
};

export async function ensureOnboardingProgress(adminClient: SupabaseClient, userId: string) {
  const { error } = await adminClient.from("user_onboarding_progress").upsert(
    {
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`onboarding_progress_upsert_failed:${error.message}`);
  }
}

export async function getOnboardingState(adminClient: SupabaseClient, userId: string) {
  await ensureOnboardingProgress(adminClient, userId);

  const [
    progressRes,
    userRes,
    profileRes,
    paymentRes,
    subscriptionRes,
    battleRes,
    queueRes,
    followRes,
    crewRes,
    challengeRes,
  ] = await Promise.all([
    adminClient.from("user_onboarding_progress").select("user_id,welcome_notification_sent_at,dismissed_at,completed_at,last_viewed_at").eq("user_id", userId).single(),
    adminClient.from("users").select("id,username").eq("id", userId).single(),
    adminClient.from("user_profiles").select("display_name,bio,avatar_url").eq("user_id", userId).maybeSingle(),
    adminClient.from("payment_ledger").select("id", { count: "exact", head: true }).eq("user_id", userId),
    adminClient.from("user_billing_profiles").select("active_subscription_plan,active_subscription_status").eq("user_id", userId).maybeSingle(),
    adminClient.from("battle_participants").select("id", { count: "exact", head: true }).eq("user_id", userId),
    adminClient.from("matchmaking_queue").select("id", { count: "exact", head: true }).eq("user_id", userId),
    adminClient.from("follows").select("id", { count: "exact", head: true }).or(`follower_id.eq.${userId},following_id.eq.${userId}`),
    adminClient.from("crew_members").select("id", { count: "exact", head: true }).eq("user_id", userId),
    adminClient.from("challenges").select("id", { count: "exact", head: true }).or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`),
  ]);

  if (progressRes.error) throw new Error(`onboarding_progress_fetch_failed:${progressRes.error.message}`);
  if (userRes.error) throw new Error(`onboarding_user_fetch_failed:${userRes.error.message}`);

  const progress = progressRes.data as ProgressRow;
  const username = userRes.data?.username ?? null;
  const profile = profileRes.data ?? null;
  const hasProfile = Boolean(username && profile && (profile.display_name || profile.bio || profile.avatar_url));
  const hasFunding = (paymentRes.count ?? 0) > 0 || Boolean(subscriptionRes.data?.active_subscription_plan);
  const hasBattle = (battleRes.count ?? 0) > 0 || (queueRes.count ?? 0) > 0;
  const hasCommunity = (followRes.count ?? 0) > 0 || (crewRes.count ?? 0) > 0 || (challengeRes.count ?? 0) > 0;

  const steps: OnboardingStep[] = [
    {
      id: "profile",
      title: "Set up your profile",
      description: "Add your battle identity so other users can recognize and follow you.",
      href: "/app/profile",
      complete: hasProfile,
    },
    {
      id: "funding",
      title: "Fund your account",
      description: "Buy tokens or activate a plan so paid battle and premium paths are available.",
      href: "/app/shop",
      complete: hasFunding,
    },
    {
      id: "battle",
      title: "Enter your first battle",
      description: "Join queue or a room so your runtime path, rating, and history start building.",
      href: "/app/battles",
      complete: hasBattle,
    },
    {
      id: "community",
      title: "Connect to the community",
      description: "Follow battlers, join a crew, or issue a challenge to activate retention loops.",
      href: "/app/community",
      complete: hasCommunity,
    },
  ];

  const completedSteps = steps.filter((step) => step.complete).length;
  const completed = completedSteps === steps.length;

  if (!progress.welcome_notification_sent_at) {
    await sendSystemNotification(adminClient, {
      userId,
      title: "Welcome to Spitzone",
      body: "Complete your setup checklist to unlock battles, community momentum, and monetization paths.",
      link: "/app",
    }).catch(() => null);

    await adminClient
      .from("user_onboarding_progress")
      .update({
        welcome_notification_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  if (completed && !progress.completed_at) {
    await adminClient
      .from("user_onboarding_progress")
      .update({
        completed_at: new Date().toISOString(),
        dismissed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  return {
    dismissed: Boolean(progress.dismissed_at) && !completed,
    completed,
    completedSteps,
    totalSteps: steps.length,
    steps,
  } satisfies OnboardingState;
}
