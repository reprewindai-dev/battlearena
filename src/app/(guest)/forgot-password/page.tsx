"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit() {
    setStatus(null);

    if (!email || !email.includes("@")) {
      setStatus({ type: "error", message: "Please enter a valid email address." });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus({
            type: "success",
            message: "Check your email! If an account exists, we've sent a password reset link.",
          });
          setEmail("");
        } else {
          setStatus({ type: "error", message: data.error ?? "Failed to send reset email." });
        }
      } catch {
        setStatus({ type: "error", message: "Something went wrong. Try again later." });
      }
    });
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-md border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="mb-6 text-center">
          <h1 className="graffiti-text text-3xl text-white mb-2">RESET PASSWORD</h1>
          <p className="text-sm text-gray-400">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
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
            {pending ? "Sending..." : "SEND RESET LINK"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link href="/login" className="text-foreground underline">
              Back to login
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
