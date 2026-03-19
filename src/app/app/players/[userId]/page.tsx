import { PlayerProfile } from "@/components/community/PlayerProfile";
import { BattleHistory } from "@/components/community/BattleHistory";
import { Separator } from "@/components/ui/separator";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Player - Spitzone" };

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const currentUser = await getSessionUser();
  const isOwnProfile = currentUser?.id === userId;

  return (
    <div className="space-y-6">
      <PlayerProfile userId={userId} isOwnProfile={isOwnProfile} />

      <Separator />

      <BattleHistory userId={userId} />
    </div>
  );
}



