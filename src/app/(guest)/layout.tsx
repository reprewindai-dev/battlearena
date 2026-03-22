import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BattleArenaWordmark } from "@/components/brand/Logo";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#070709] text-foreground">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(246,183,60,0.18),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(255,106,61,0.16),_transparent_20%),linear-gradient(180deg,_#0b0b0d_0%,_#060607_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(90deg,_rgba(255,255,255,0.02)_1px,_transparent_1px),linear-gradient(180deg,_rgba(255,255,255,0.02)_1px,_transparent_1px)] bg-[size:72px_72px] opacity-20" />
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-sm font-medium tracking-wide text-white">
          <BattleArenaWordmark size="small" className="text-base" />
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" className="border border-white/10 bg-white/5 text-white hover:bg-white/10">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild className="bg-[#f6b73c] text-black hover:bg-[#ffd071]">
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-6 pb-20 pt-4">{children}</main>
    </div>
  );
}

