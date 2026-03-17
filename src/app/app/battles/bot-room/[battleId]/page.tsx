import { redirect } from "next/navigation";

export default async function BotBattleRoomPage({
  params,
}: {
  params: Promise<{ battleId: string }>;
}) {
  const { battleId } = await params;
  redirect(`/app/battles/room?battleId=${encodeURIComponent(battleId)}`);
}
