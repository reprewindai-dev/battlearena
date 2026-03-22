import { Leaderboard } from "@/components/community/Leaderboard";
import { CommunityStats } from "@/components/community/CommunityStats";

export const metadata = { title: "Leaderboard - Spitzone" };

export default function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Top battlers ranked by ELO rating.
        </p>
      </div>

      <CommunityStats />

      <Leaderboard />
    </div>
  );
}




