import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PlayerProfile } from "@/components/community/PlayerProfile";
import { BattleHistory } from "@/components/community/BattleHistory";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "My Profile – Battle Arena" };

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/app/profile");

  return (
    <div className="space-y-6">
      <PlayerProfile userId={user.id} isOwnProfile />

      <Separator />

      <BattleHistory userId={user.id} />
    </div>
  );
}
