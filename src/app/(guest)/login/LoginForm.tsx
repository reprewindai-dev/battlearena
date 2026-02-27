"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();

  const safeNextPath = useMemo(() => {
    if (!nextPath || !nextPath.startsWith("/")) return "/app";
    if (nextPath.startsWith("//")) return "/app";
    return nextPath;
  }, [nextPath]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSupabaseLogin() {
    setError(null);

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError("Enter a valid email and password.");
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push(safeNextPath);
      router.refresh();
    } catch {
      setError(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    }
  }

  return (
    <Card className="border-border/60 bg-card/40 p-6 backdrop-blur">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            await handleSupabaseLogin();
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          Login
        </Button>

        <div className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-foreground underline">
            Sign up
          </Link>
        </div>
      </form>
    </Card>
  );
}
