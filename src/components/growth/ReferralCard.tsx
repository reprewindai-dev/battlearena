"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ReferralResponse = {
  primary: {
    inviteLink: string;
    clicks: number;
    signups: number;
    activations: number;
  } | null;
  totals: {
    clicks: number;
    signups: number;
    activations: number;
  };
};

export function ReferralCard() {
  const [data, setData] = React.useState<ReferralResponse | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const response = await fetch("/api/referrals", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const body = (await response.json()) as ReferralResponse;
      if (!cancelled) {
        setData(body);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const inviteLink = data?.primary?.inviteLink ?? null;

  async function copyInviteLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink).catch(() => null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (!data || !inviteLink) {
    return null;
  }

  return (
    <Card className="border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f6b73c]">
            Growth Loop
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Invite battlers, artists, and producers</h2>
            <p className="mt-1 text-sm text-white/70">
              Your live invite link attributes signups and activations so growth is measurable from the first showcase wave.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
            {inviteLink}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:min-w-[280px]">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <div className="text-lg font-black text-white">{data.totals.clicks}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Clicks</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <div className="text-lg font-black text-white">{data.totals.signups}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Signups</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <div className="text-lg font-black text-white">{data.totals.activations}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Activated</div>
            </div>
          </div>
          <Button onClick={() => void copyInviteLink()} className="bg-[#f6b73c] text-black hover:bg-[#ffd071]">
            {copied ? "Invite link copied" : "Copy invite link"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
