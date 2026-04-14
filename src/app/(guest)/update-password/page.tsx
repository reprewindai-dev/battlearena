"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabasePublicClient } from "@/lib/supabase/public";

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
      const supabase = createSupabasePublicClient();
      const { data } = await supabase.auth.getSession();
      
      if (!data.session) {
        setStatus({
          type: "error",
          message: "Invalid or expired reset link. Please request a new one.",
        });
      }
      setCheckingSession(false);
    }
    checkSession();
  }, []);

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
        const supabase = createSupabasePublicClient();
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
