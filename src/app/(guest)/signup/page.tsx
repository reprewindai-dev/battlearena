"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSignup() {
    setError(null);
    setSuccess(null);

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError("Enter a valid email and password.");
      return;
    }

    try {
      const nextParam =
        typeof window === "undefined"
          ? null
          : new URLSearchParams(window.location.search).get("next");
      const safeNextPath =
        nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
          ? nextParam
          : "/app";

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: parsed.data.email,
          password: parsed.data.password,
          nextPath: safeNextPath,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; requiresEmailConfirmation?: boolean }
        | null;

      if (!response.ok) {
        setError(data?.error ?? "Signup failed.");
        return;
      }

      if (!data?.requiresEmailConfirmation) {
        router.push(safeNextPath);
        router.refresh();
        return;
      }

      setSuccess("Account created. Check your email to confirm your Battle Arena account before signing in.");
    } catch {
      setError(
        "Signup is temporarily unavailable. Try again in a moment.",
      );
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-stretch">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,106,61,0.22),_transparent_30%),linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-8 lg:col-span-7">
        <div className="absolute inset-0 bg-[linear-gradient(140deg,_transparent,_rgba(255,255,255,0.03)_48%,_transparent_75%)]" />
        <div className="relative space-y-8">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-[#ff6a3d]/30 bg-[#ff6a3d]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#ffb08d]">
              Creator Access
            </div>
            <h1 className="max-w-xl text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
              Claim your identity before the crowd gets here.
            </h1>
            <p className="max-w-lg text-sm leading-6 text-white/70 sm:text-base">
              Open your Battle Arena profile, secure your handle, and step into the room ready for
              battles, tournaments, and producer discovery.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-2xl font-black text-white">Own</div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/45">
                Your profile and handle
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-2xl font-black text-white">Enter</div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/45">
                Queue, battles, tournaments
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-2xl font-black text-white">Build</div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/45">
                Audience and revenue paths
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5">
        <Card className="border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                await handleSignup();
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
                autoComplete="new-password"
              />
            </div>

            {error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : null}
            {success ? (
              <div className="text-sm text-emerald-400">{success}</div>
            ) : null}

            <Button
              type="submit"
              className="w-full bg-[#f6b73c] text-black hover:bg-[#ffd071]"
              disabled={pending}
            >
              Create account
            </Button>

            <div className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-foreground underline">
                Login
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

