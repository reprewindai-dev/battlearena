import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BattleParticipantRow = {
  user_id: string;
  slot: number;
};

type BattleAnalyticsRow = {
  viewer_count: number | null;
  engagement_score: number | null;
  audio_quality_score: number | null;
  video_quality_score: number | null;
  session_duration_seconds: number | null;
};

type BattleRow = {
  id: string;
  created_at: string | null;
  result: { winner_slot?: number | null } | null;
  entry_fee_tokens: number | null;
  battle_participants: BattleParticipantRow[];
  battle_analytics: BattleAnalyticsRow[];
};

function toBattleResult(
  battle: BattleRow,
  userId: string,
): "win" | "loss" | "tie" {
  const userSlot = battle.battle_participants.find((p) => p.user_id === userId)?.slot;
  const winnerSlot = battle.result?.winner_slot ?? null;
  if (!winnerSlot || !userSlot) return "tie";
  return winnerSlot === userSlot ? "win" : "loss";
}

function calculateBattleEarningsTokens(battle: BattleRow, result: "win" | "loss" | "tie") {
  if (result !== "win") return 0;
  const entryFee = battle.entry_fee_tokens ?? 0;
  if (entryFee <= 0) return 0;
  const participantCount = Math.max(1, battle.battle_participants.length);
  return entryFee * participantCount;
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const [profileRes, billingProfileRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_billing_profiles")
        .select("active_subscription_plan,active_subscription_status")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const tier = profileRes.data?.subscription_tier ?? "free";
    const billingPlan = billingProfileRes.data?.active_subscription_plan ?? null;
    const billingStatus = billingProfileRes.data?.active_subscription_status ?? null;

    const hasAnalyticsAccess =
      tier === "pro" ||
      tier === "enterprise" ||
      ((billingPlan === "pro" || billingPlan === "enterprise") &&
        (billingStatus === "active" || billingStatus === "trialing"));

    if (!hasAnalyticsAccess) {
      return NextResponse.json({ error: "Analytics requires Pro plan" }, { status: 403 });
    }

    const { data: battlesData, error: battlesError } = await supabase
      .from("battles")
      .select(`
        id,
        created_at,
        result,
        entry_fee_tokens,
        battle_participants!inner(
          user_id,
          slot
        ),
        battle_analytics(
          viewer_count,
          engagement_score,
          audio_quality_score,
          video_quality_score,
          session_duration_seconds
        )
      `)
      .or(`created_by.eq.${user.id},battle_participants.user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (battlesError) {
      return NextResponse.json(
        { error: "analytics_query_failed", details: battlesError.message },
        { status: 400 },
      );
    }

    const battles = (battlesData ?? []) as BattleRow[];
    if (!battles.length) {
      return NextResponse.json({
        totalBattles: 0,
        winRate: 0,
        avgViewers: 0,
        avgEngagement: 0,
        avgAudioQuality: 0,
        avgVideoQuality: 0,
        totalEarningsTokens: 0,
        monthlyGrowth: 0,
        recentBattles: [],
      });
    }

    const totalBattles = battles.length;
    const battleWithResult = battles.map((battle) => {
      const result = toBattleResult(battle, user.id);
      const earningsTokens = calculateBattleEarningsTokens(battle, result);
      return { battle, result, earningsTokens };
    });

    const wins = battleWithResult.filter((row) => row.result === "win").length;
    const winRate = totalBattles > 0 ? wins / totalBattles : 0;

    const avgViewers =
      battleWithResult.reduce(
        (sum, row) => sum + (row.battle.battle_analytics[0]?.viewer_count ?? 0),
        0,
      ) / totalBattles;
    const avgEngagement =
      battleWithResult.reduce(
        (sum, row) => sum + Number(row.battle.battle_analytics[0]?.engagement_score ?? 0),
        0,
      ) / totalBattles;
    const avgAudioQuality =
      battleWithResult.reduce(
        (sum, row) => sum + Number(row.battle.battle_analytics[0]?.audio_quality_score ?? 0),
        0,
      ) / totalBattles;
    const avgVideoQuality =
      battleWithResult.reduce(
        (sum, row) => sum + Number(row.battle.battle_analytics[0]?.video_quality_score ?? 0),
        0,
      ) / totalBattles;

    const totalEarningsTokens = battleWithResult.reduce(
      (sum, row) => sum + row.earningsTokens,
      0,
    );

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const thisMonthBattles = battles.filter((battle) => {
      if (!battle.created_at) return false;
      const date = new Date(battle.created_at);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    }).length;

    const lastMonthBattles = battles.filter((battle) => {
      if (!battle.created_at) return false;
      const date = new Date(battle.created_at);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    }).length;

    const monthlyGrowth =
      lastMonthBattles > 0 ? (thisMonthBattles - lastMonthBattles) / lastMonthBattles : 0;

    const recentBattles = battleWithResult.slice(0, 10).map((row) => {
      const opponent = row.battle.battle_participants.find((p) => p.user_id !== user.id);
      return {
        id: row.battle.id,
        opponent: opponent?.user_id ?? "unknown",
        result: row.result,
        viewers: row.battle.battle_analytics[0]?.viewer_count ?? 0,
        engagement: Number(row.battle.battle_analytics[0]?.engagement_score ?? 0),
        earningsTokens: row.earningsTokens,
        date: row.battle.created_at ?? new Date().toISOString(),
      };
    });

    return NextResponse.json({
      totalBattles,
      winRate,
      avgViewers: Math.round(avgViewers),
      avgEngagement,
      avgAudioQuality,
      avgVideoQuality,
      totalEarningsTokens,
      monthlyGrowth,
      recentBattles,
    });
  } catch (error) {
    console.error("Analytics fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
