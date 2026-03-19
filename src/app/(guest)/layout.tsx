import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-sm font-medium tracking-wide">
          SPLITZONE
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-16">{children}</main>
    </div>
  );
}
