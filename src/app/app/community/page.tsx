import { CommunityFeed } from "@/components/community/CommunityFeed";
import { CommunityStats } from "@/components/community/CommunityStats";
import { Leaderboard } from "@/components/community/Leaderboard";
import { CommunityCrews } from "@/components/community/CommunityCrews";
import { CommunityMentorships } from "@/components/community/CommunityMentorships";
import { CommunityEvents } from "@/components/community/CommunityEvents";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Community - Battle Arena" };

export default function CommunityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live activity, rankings, and everything happening in the Arena.
        </p>
      </div>

      <CommunityStats />

      <Separator />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CommunityFeed />
        </div>
        <div className="lg:col-span-2">
          <Leaderboard />
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-3">
        <CommunityCrews />
        <CommunityMentorships />
        <CommunityEvents />
      </div>
    </div>
  );
}

