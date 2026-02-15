import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function AppHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">App</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Foundation shell: auth, RBAC, moderation, economy, battles.
        </p>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="text-sm font-medium">Quick links</div>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <Link href="/app/profile" className="hover:underline">
              Profile
            </Link>
            <Link href="/app/battles" className="hover:underline">
              Battle Lobby
            </Link>
            <Link href="/app/battles/room" className="hover:underline">
              Battle Room (skeleton)
            </Link>
            <Link href="/app/moderation" className="hover:underline">
              Moderation Console
            </Link>
            <Link href="/app/admin" className="hover:underline">
              Admin Panel
            </Link>
          </div>
        </Card>

        <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
          <div className="text-sm font-medium">Status</div>
          <div className="mt-3 text-sm text-muted-foreground">
            This app is wired to run locally with mock auth until Supabase env vars
            are provided.
          </div>
        </Card>
      </div>
    </div>
  );
}
