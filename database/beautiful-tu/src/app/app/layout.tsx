import Link from "next/link";
import { redirect } from "next/navigation";

import { BattleArenaLogo, BattleArenaWordmark } from "@/components/brand/Logo";
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
    <div className="spitzone-shell-background spitzone-noise min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/app" className="flex shrink-0 items-center gap-3">
            <BattleArenaLogo size="medium" />
            <div className="hidden sm:block">
              <BattleArenaWordmark size="small" />
            </div>
          </Link>

          <div className="hidden max-w-xs flex-1 md:block">
            <SearchBar compact />
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden rounded-full border border-white/8 bg-white/4 text-white/80 hover:bg-white/10 sm:inline-flex">
              <Link href="/app/community">Community</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden rounded-full border border-white/8 bg-white/4 text-white/80 hover:bg-white/10 sm:inline-flex">
              <Link href="/app/battles">Battles</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden rounded-full border border-white/8 bg-white/4 text-white/80 hover:bg-white/10 sm:inline-flex">
              <Link href="/app/leaderboard">Ranks</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden rounded-full border border-white/8 bg-white/4 text-white/80 hover:bg-white/10 sm:inline-flex">
              <Link href="/app/shop">Shop</Link>
            </Button>

            <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />

            <NotificationBell />

            <Button asChild variant="ghost" size="sm" className="rounded-full border border-white/8 bg-white/4 text-white/80 hover:bg-white/10">
              <Link href="/app/profile" className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-xs font-bold text-primary">
                  {(user.email?.[0] ?? "U").toUpperCase()}
                </span>
                <span className="hidden text-xs uppercase tracking-[0.2em] text-white/58 sm:inline">{role}</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-4 py-6 sm:px-6">
        <aside className="col-span-12 md:col-span-3 xl:col-span-2">
          <nav className="spitzone-panel-strong spitzone-metal-line sticky top-24 p-4">
            <div className="mb-3 px-2">
              <div className="spitzone-kicker">Network map</div>
              <div className="mt-1 text-xs text-white/56">Queues, rooms, beats, rank, and control.</div>
            </div>
            <div className="space-y-1">
              {allNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`spitzone-nav-link ${link.href === "/app" ? "spitzone-nav-link-active" : ""}`}
                >
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              ))}
            </div>

            <Separator className="my-3" />

            <div className="space-y-3 px-2">
              <div className="spitzone-chip-live">Live network online</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/42">
                {user.email} | {role}
              </div>
            </div>
          </nav>
        </aside>

        <main className="col-span-12 min-w-0 md:col-span-9 xl:col-span-10">{children}</main>
      </div>
    </div>
  );
}

