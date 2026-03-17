import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
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

    // Check if user has analytics access
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.subscription_tier !== "pro" && profile.subscription_tier !== "enterprise")) {
      return NextResponse.json({ error: "Analytics requires Pro plan" }, { status: 403 });
    }

    // Get battle analytics
    const { data: battles } = await supabase
      .from("battles")
      .select(`
        id,
        created_at,
        result,
        battle_participants!inner(
          user_id,
          slot
        ),
        battle_analytics!inner(
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

    if (!battles) {
      return NextResponse.json({
        totalBattles: 0,
        winRate: 0,
        avgViewers: 0,
        avgEngagement: 0,
        avgAudioQuality: 0,
        avgVideoQuality: 0,
        totalEarnings: 0,
        monthlyGrowth: 0,
        recentBattles: [],
      });
    }

    // Calculate analytics
    const totalBattles = battles.length;
    const wins = battles.filter(b => {
      const result = b.result as { winner_slot?: number | null } | null;
      return result?.winner_slot === b.battle_participants.find(p => p.user_id === user.id)?.slot;
    }).length;
    const winRate = totalBattles > 0 ? wins / totalBattles : 0;

    const avgViewers = battles.reduce((sum, b) => sum + (b.battle_analytics[0]?.viewer_count || 0), 0) / totalBattles;
    const avgEngagement = battles.reduce((sum, b) => sum + (b.battle_analytics[0]?.engagement_score || 0), 0) / totalBattles;
    const avgAudioQuality = battles.reduce((sum, b) => sum + (b.battle_analytics[0]?.audio_quality_score || 0), 0) / totalBattles;
    const avgVideoQuality = battles.reduce((sum, b) => sum + (b.battle_analytics[0]?.video_quality_score || 0), 0) / totalBattles;

    // Calculate earnings (mock for now)
    const totalEarnings = wins * 5.00; // $5 per win

    // Calculate monthly growth
    const thisMonth = new Date().getMonth();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const thisYear = new Date().getFullYear();
    const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const thisMonthBattles = battles.filter(b => {
      const date = new Date(b.created_at!);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    }).length;

    const lastMonthBattles = battles.filter(b => {
      const date = new Date(b.created_at!);
      return date.getMonth() === lastMonth && date.getFullYear() === lastYear;
    }).length;

    const monthlyGrowth = lastMonthBattles > 0 ? (thisMonthBattles - lastMonthBattles) / lastMonthBattles : 0;

    // Format recent battles
    const recentBattles = battles.slice(0, 10).map(battle => {
      const participant = battle.battle_participants.find(p => p.user_id !== user.id);
      const battleResult = battle.result as { winner_slot?: number | null } | null;
      const userSlot = battle.battle_participants.find(p => p.user_id === user.id)?.slot;
      const result = battleResult?.winner_slot === userSlot ? "win" : 
                    battleResult?.winner_slot ? "loss" : "tie";
      
      return {
        id: battle.id,
        opponent: participant?.user_id || "Unknown",
        result,
        viewers: battle.battle_analytics[0]?.viewer_count || 0,
        engagement: battle.battle_analytics[0]?.engagement_score || 0,
        earnings: result === "win" ? 5.00 : 0,
        date: battle.created_at!,
      };
    });

    return NextResponse.json({
      totalBattles,
      winRate,
      avgViewers: Math.round(avgViewers),
      avgEngagement,
      avgAudioQuality,
      avgVideoQuality,
      totalEarnings,
      monthlyGrowth,
      recentBattles,
    });
  } catch (error) {
    console.error("Analytics fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
