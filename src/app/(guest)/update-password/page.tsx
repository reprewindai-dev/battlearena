"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function UpdatePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if user came from valid reset link
  useEffect(() => {
    async function checkSession() {
      const supabase = createSupabaseBrowserClient();
      const code = searchParams.get("code");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        await supabase.auth
          .setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          .catch(() => null);

        // Remove sensitive tokens from URL after session hydration.
        window.history.replaceState({}, "", window.location.pathname + window.location.search);
      }

      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => null);
      }

      const { data: initialSession } = await supabase.auth.getSession();
      if (initialSession.session) {
        setCheckingSession(false);
        return;
      }

      // Give the browser client a short window to hydrate hash-based recovery tokens.
      await new Promise((resolve) => setTimeout(resolve, 350));
      const { data: hydratedSession } = await supabase.auth.getSession();

      if (!hydratedSession.session) {
        setStatus({
          type: "error",
          message: "Invalid or expired reset link. Please request a new one.",
        });
      }

      setCheckingSession(false);
    }
    checkSession();
  }, [searchParams]);

  async function handleSubmit() {
    setStatus(null);

    if (password.length < 6) {
      setStatus({ type: "error", message: "Password must be at least 6 characters." });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.updateUser({
          password,
        });

        if (error) {
          setStatus({ type: "error", message: error.message });
          return;
        }

        setStatus({
          type: "success",
          message: "Password updated successfully! Redirecting...",
        });

        // Redirect after success
        setTimeout(() => {
          const next = searchParams.get("next") ?? "/app";
          router.push(next);
        }, 2000);
      } catch {
        setStatus({ type: "error", message: "Failed to update password." });
      }
    });
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-gray-400">Verifying reset link...</p>
        </Card>
      </div>
    );
  }

  if (status?.type === "error" && !password) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <Card className="w-full max-w-md border-red-500/30 bg-red-500/10 p-8">
          <h1 className="graffiti-text text-2xl text-red-400 mb-4">LINK EXPIRED</h1>
          <p className="text-gray-400 mb-6">{status.message}</p>
          <Link href="/forgot-password">
            <Button className="w-full btn-aggressive">REQUEST NEW LINK</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-md border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="mb-6 text-center">
          <h1 className="graffiti-text text-3xl text-white mb-2">NEW PASSWORD</h1>
          <p className="text-sm text-gray-400">Choose a strong password for your account</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={pending}
            />
          </div>

          {status && (
            <div
              className={`text-sm ${
                status.type === "success" ? "text-green-400" : "text-red-400"
              }`}
            >
              {status.message}
            </div>
          )}

          <Button
            type="submit"
            className="w-full btn-aggressive"
            disabled={pending}
          >
            {pending ? "Updating..." : "UPDATE PASSWORD"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[80vh] items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-gray-400">Loading...</p>
        </Card>
      </div>
    }>
      <UpdatePasswordContent />
    </Suspense>
  );
}
