"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { z } from "zod";

import OAuthButtons from "@/components/auth/OAuthButtons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function mapAuthError(error: string | null) {
  switch (error) {
    case "missing_code":
      return "Your sign-in link was incomplete. Request a new confirmation email.";
    case "supabase_unavailable":
      return "Authentication is not configured correctly in this environment.";
    case "auth_callback_failed":
      return "Your sign-in link expired or is invalid. Request a new confirmation email.";
    case "login_unavailable":
      return "Login is temporarily unavailable. Try again in a moment.";
    default:
      return null;
  }
}

export default function LoginForm({
  nextPath,
  initialError,
}: {
  nextPath: string;
  initialError?: string | null;
}) {
  const router = useRouter();

  const safeNextPath = useMemo(() => {
    if (!nextPath || !nextPath.startsWith("/")) return "/app";
    if (nextPath.startsWith("//")) return "/app";
    return nextPath;
  }, [nextPath]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(mapAuthError(initialError ?? null));
  const [pending, startTransition] = useTransition();

  async function handleLogin() {
    setError(null);

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError("Enter a valid email and password.");
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "Login failed.");
        return;
      }

      router.push(safeNextPath);
      router.refresh();
    } catch {
      setError("Login is temporarily unavailable. Try again in a moment.");
    }
  }

  return (
    <Card className="border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <OAuthButtons mode="login" nextPath={safeNextPath} />
      
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            await handleLogin();
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}

        <Button
          type="submit"
          className="w-full bg-[#f6b73c] text-black hover:bg-[#ffd071]"
          disabled={pending}
        >
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
