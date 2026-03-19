import { BeatLibraryWrapper } from "@/components/beat-library/BeatLibraryWrapper";
import { CommunityStats } from "@/components/community/CommunityStats";
import { Separator } from "@/components/ui/separator";
import { Music } from "lucide-react";
import { getSessionRole } from "@/lib/auth/session";

export const metadata = { title: "Beat Library - Spitzone" };

export default async function BeatsPage() {
  const role = await getSessionRole();
  const canUpload = role === "admin" || role === "mod";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Music className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Beat Library</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and preview beats licensed for battle use. Select a beat before entering Spitzone.
        </p>
      </div>

      <CommunityStats />

      <Separator className="border-border/40" />

      <BeatLibraryWrapper canUpload={canUpload} />
    </div>
  );
}



