import Link from "next/link";
import { redirect } from "next/navigation";

import { NotificationBell } from "@/components/community/NotificationBell";
import { SearchBar } from "@/components/community/SearchBar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getSessionRole, getSessionUser } from "@/lib/auth/session";

const NAV_LINKS = [
  { href: "/app", label: "Home", icon: "HM" },
  { href: "/app/community", label: "Community", icon: "CM" },
  { href: "/app/battles", label: "Battle Lobby", icon: "BT" },
  { href: "/app/leaderboard", label: "Leaderboard", icon: "LB" },
  { href: "/app/tournaments", label: "Tournaments", icon: "TN" },
  { href: "/app/challenges", label: "Challenges", icon: "CH" },
  { href: "/app/shop", label: "Shop", icon: "SH" },
  { href: "/app/profile", label: "My Profile", icon: "PF" },
  { href: "/app/battles/history", label: "Battle History", icon: "BH" },
  { href: "/app/search", label: "Search", icon: "SR" },
  { href: "/app/beats", label: "Beat Library", icon: "BE" },
];

const MOD_LINKS = [{ href: "/app/moderation", label: "Moderation", icon: "MD" }];

const ADMIN_LINKS = [{ href: "/app/admin", label: "Admin Panel", icon: "AD" }];

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

  const allNavLinks = [
    ...NAV_LINKS,
    ...(role === "mod" || role === "admin" ? MOD_LINKS : []),
    ...(role === "admin" ? ADMIN_LINKS : []),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/app" className="shrink-0">
            <span className="text-lg font-black tracking-tight">BATTLE ARENA</span>
          </Link>

          <div className="hidden max-w-xs flex-1 md:block">
            <SearchBar compact />
          </div>

          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/app/community">Community</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/app/battles">Battles</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/app/leaderboard">Ranks</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/app/shop">Shop</Link>
            </Button>

            <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />

            <NotificationBell />

            <Button asChild variant="ghost" size="sm">
              <Link href="/app/profile" className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {(user.email?.[0] ?? "U").toUpperCase()}
                </span>
                <span className="hidden sm:inline">{role}</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-4 py-6 sm:px-6">
        <aside className="col-span-12 md:col-span-3 xl:col-span-2">
          <nav className="sticky top-20 rounded-xl border border-border/60 bg-card/30 p-3 backdrop-blur">
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Navigation
            </div>
            <div className="space-y-0.5">
              {allNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              ))}
            </div>

            <Separator className="my-3" />

            <div className="px-2 text-[10px] text-muted-foreground/50">
              {user.email} | {role}
            </div>
          </nav>
        </aside>

        <main className="col-span-12 min-w-0 md:col-span-9 xl:col-span-10">{children}</main>
      </div>
    </div>
  );
}

