import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getSessionRole, getSessionUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  const role = await getSessionRole();

  if (!user) {
    redirect("/login?next=/app");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/app" className="text-sm font-medium tracking-wide">
              ARENA
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <div className="text-xs text-muted-foreground">
              {user ? user.email ?? user.id : "Unknown"} · {role}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/profile">Profile</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/battles">Battles</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/moderation">Moderation</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/admin">Admin</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-6 py-8">
        <aside className="col-span-12 md:col-span-3">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur">
            <div className="text-xs font-medium text-muted-foreground">NAV</div>
            <div className="mt-3 grid gap-2 text-sm">
              <Link className="hover:underline" href="/app">
                Home
              </Link>
              <Link className="hover:underline" href="/app/profile">
                Profile
              </Link>
              <Link className="hover:underline" href="/app/battles">
                Battle Lobby
              </Link>
              <Link className="hover:underline" href="/app/battles/room">
                Battle Room
              </Link>
              <Link className="hover:underline" href="/app/moderation">
                Moderation Console
              </Link>
              <Link className="hover:underline" href="/app/admin">
                Admin Panel
              </Link>
            </div>
          </div>
        </aside>

        <main className="col-span-12 md:col-span-9">{children}</main>
      </div>
    </div>
  );
}
