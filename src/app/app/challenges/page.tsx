"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "@/lib/utils";
import { ChallengeModal } from "@/components/community/ChallengeModal";

type ChallengeParticipant = {
  id: string;
  handle: string;
  display_name: string | null;
  elo_rating: number;
  tier: string;
  avatar_url: string | null;
};

type Challenge = {
  id: string;
  status: string;
  battle_mode: string;
  wager_tokens: number | null;
  message: string | null;
  expires_at: string;
  created_at: string;
  challenger: ChallengeParticipant;
  challenged: ChallengeParticipant;
};

const TIER_COLORS: Record<string, string> = {
  bronze: "text-amber-600", silver: "text-slate-400",
  gold: "text-yellow-400", platinum: "text-cyan-400",
  diamond: "text-blue-400", legend: "text-purple-400",
};

function ChallengeCard({
  challenge,
  direction,
  onAction,
}: {
  challenge: Challenge;
  direction: "incoming" | "outgoing";
  onAction: () => void;
}) {
  const [loading, setLoading] = React.useState<"accept" | "decline" | null>(null);
  const opponent = direction === "incoming" ? challenge.challenger : challenge.challenged;

  async function handleAction(action: "accept" | "decline") {
    setLoading(action);
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Action failed");
        return;
      }
      toast.success(action === "accept" ? "Challenge accepted!" : "Challenge declined");
      onAction();
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(null);
    }
  }

  const expiresIn = new Date(challenge.expires_at).getTime() - Date.now();
  const isExpiringSoon = expiresIn < 3600_000; // 1 hour

  return (
    <Card className="border-border/60 bg-card/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/30 text-sm font-bold">
            {(opponent.display_name ?? opponent.handle)[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/app/players/${opponent.id}`} className="font-semibold hover:underline">
                {opponent.display_name ?? opponent.handle}
              </Link>
              <span className={`text-xs font-medium uppercase ${TIER_COLORS[opponent.tier] ?? ""}`}>
                {opponent.tier}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              @{opponent.handle} - {opponent.elo_rating} ELO
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">{challenge.battle_mode}</Badge>
          {challenge.wager_tokens && (
            <Badge variant="outline" className="border-yellow-500/40 text-xs text-yellow-400">
              <Zap className="mr-1 h-3 w-3" />{challenge.wager_tokens} tokens
            </Badge>
          )}
        </div>
      </div>

      {challenge.message && (
        <blockquote className="mt-3 border-l-2 border-border/60 pl-3 text-sm italic text-muted-foreground">
          "{challenge.message}"
        </blockquote>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className={`flex items-center gap-1 text-xs ${isExpiringSoon ? "text-red-400" : "text-muted-foreground"}`}>
          <Clock className="h-3 w-3" />
          {direction === "incoming" ? "Sent" : "Expires"} {formatDistanceToNow(challenge.created_at)}
        </div>

        {direction === "incoming" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleAction("accept")}
              disabled={!!loading}
            >
              {loading === "accept" ? "..." : <><CheckCircle className="mr-1.5 h-3.5 w-3.5" />Accept</>}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction("decline")}
              disabled={!!loading}
            >
              {loading === "decline" ? "..." : <><XCircle className="mr-1.5 h-3.5 w-3.5" />Decline</>}
            </Button>
          </div>
        )}

        {direction === "outgoing" && (
          <Badge variant="outline" className="text-xs text-muted-foreground">Pending response</Badge>
        )}
      </div>
    </Card>
  );
}

type ChallengeTarget = {
  id: string;
  handle: string;
  display_name: string | null;
  elo_rating: number;
  tier: string;
};

export default function ChallengesPage() {
  const searchParams = useSearchParams();
  const [incoming, setIncoming] = React.useState<Challenge[]>([]);
  const [outgoing, setOutgoing] = React.useState<Challenge[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"incoming" | "outgoing">("incoming");
  const [challengeTarget, setChallengeTarget] = React.useState<ChallengeTarget | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  // If ?challenge=userId is in the URL, fetch that user's profile and auto-open modal
  React.useEffect(() => {
    const targetId = searchParams.get("challenge");
    if (!targetId) return;
    fetch(`/api/users/${targetId}/profile`)
      .then(r => r.json())
      .then(data => {
        if (data.profile) {
          setChallengeTarget({
            id: targetId,
            handle: data.profile.handle,
            display_name: data.profile.display_name,
            elo_rating: data.profile.elo_rating,
            tier: data.profile.tier,
          });
          setModalOpen(true);
        }
      })
      .catch(() => {});
  }, [searchParams]);

  async function fetchChallenges() {
    setLoading(true);
    try {
      const [incRes, outRes] = await Promise.all([
        fetch("/api/challenges?direction=incoming"),
        fetch("/api/challenges?direction=outgoing"),
      ]);
      const [incData, outData] = await Promise.all([incRes.json(), outRes.json()]);
      setIncoming(incData.challenges ?? []);
      setOutgoing(outData.challenges ?? []);
    } catch {}
    setLoading(false);
  }

  React.useEffect(() => { fetchChallenges(); }, []);

  const displayed = tab === "incoming" ? incoming : outgoing;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Challenges</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pending challenges. Respond within 24 hours.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={tab === "incoming" ? "default" : "outline"}
          onClick={() => setTab("incoming")}
        >
          Incoming {incoming.length > 0 && `(${incoming.length})`}
        </Button>
        <Button
          size="sm"
          variant={tab === "outgoing" ? "default" : "outline"}
          onClick={() => setTab("outgoing")}
        >
          Outgoing {outgoing.length > 0 && `(${outgoing.length})`}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted/30" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <Card className="border-border/60 bg-card/30 p-10 text-center">
          <Zap className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-2 text-sm text-muted-foreground">
            {tab === "incoming" ? "No incoming challenges." : "No outgoing challenges."}
          </p>
          {tab === "outgoing" && (
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link href="/app/search">Find someone to challenge</Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map(c => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              direction={tab}
              onAction={fetchChallenges}
            />
          ))}
        </div>
      )}

      {/* Auto-open challenge modal when arriving via ?challenge=userId */}
      <ChallengeModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setChallengeTarget(null);
        }}
        target={challengeTarget}
      />
    </div>
  );
}

