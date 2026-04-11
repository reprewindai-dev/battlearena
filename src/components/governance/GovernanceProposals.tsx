"use client";

import * as React from "react";
import { ThumbsUp, ThumbsDown, Minus, Plus, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProposalStatus = "open" | "closed" | "cancelled" | "implemented";
type ProposalResult = "passed" | "failed" | "tie" | "no_quorum" | null;

type Proposal = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: ProposalStatus;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  quorum_required: number;
  voting_ends_at: string;
  result: ProposalResult;
  created_at: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  rules: "Rules",
  economy: "Economy",
  features: "Features",
  moderation: "Moderation",
  community: "Community",
  tournaments: "Tournaments",
  general: "General",
};

const STATUS_COLORS: Record<ProposalStatus, string> = {
  open: "border-green-500/40 text-green-400",
  closed: "border-muted-foreground/40 text-muted-foreground",
  cancelled: "border-destructive/40 text-destructive",
  implemented: "border-blue-500/40 text-blue-400",
};

function VoteBar({ votesFor, votesAgainst, votesAbstain }: { votesFor: number; votesAgainst: number; votesAbstain: number }) {
  const total = votesFor + votesAgainst + votesAbstain;
  if (total === 0) return <div className="h-1.5 rounded-full bg-muted/40" />;
  const pctFor = (votesFor / total) * 100;
  const pctAgainst = (votesAgainst / total) * 100;
  const pctAbstain = (votesAbstain / total) * 100;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/40">
      <div className="bg-green-500" style={{ width: `${pctFor}%` }} />
      <div className="bg-red-500" style={{ width: `${pctAgainst}%` }} />
      <div className="bg-muted-foreground/40" style={{ width: `${pctAbstain}%` }} />
    </div>
  );
}

function ProposalCard({ proposal, onVote }: { proposal: Proposal; onVote: (id: string, vote: string) => void }) {
  const total = proposal.votes_for + proposal.votes_against + proposal.votes_abstain;
  const endsAt = new Date(proposal.voting_ends_at);
  const isExpired = endsAt < new Date();
  const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const quorumMet = total >= proposal.quorum_required;

  return (
    <Card className="border-border/60 bg-card/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[proposal.category] ?? proposal.category}</Badge>
              <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[proposal.status]}`}>
                {proposal.status}
              </Badge>
              {proposal.result && (
                <Badge variant="outline" className={`text-[10px] ${proposal.result === "passed" ? "border-green-500/40 text-green-400" : "border-red-500/40 text-red-400"}`}>
                  {proposal.result}
                </Badge>
              )}
            </div>
            <CardTitle className="text-sm font-semibold leading-snug">{proposal.title}</CardTitle>
          </div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{proposal.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <VoteBar votesFor={proposal.votes_for} votesAgainst={proposal.votes_against} votesAbstain={proposal.votes_abstain} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex gap-3">
            <span className="text-green-400 font-medium">{proposal.votes_for} for</span>
            <span className="text-red-400 font-medium">{proposal.votes_against} against</span>
            <span>{proposal.votes_abstain} abstain</span>
          </div>
          <span>{total}/{proposal.quorum_required} votes {quorumMet ? "✓" : "(quorum needed)"}</span>
        </div>

        {proposal.status === "open" && !isExpired && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
              onClick={() => onVote(proposal.id, "for")}
            >
              <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> For
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => onVote(proposal.id, "against")}
            >
              <ThumbsDown className="mr-1.5 h-3.5 w-3.5" /> Against
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-muted/30"
              onClick={() => onVote(proposal.id, "abstain")}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {isExpired ? "Voting ended" : `${daysLeft}d left to vote`} ·{" "}
          {new Date(proposal.created_at).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}

export function GovernanceProposals() {
  const [proposals, setProposals] = React.useState<Proposal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<"open" | "closed" | "all">("open");
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    category: "general",
    voting_days: 7,
  });

  const fetchProposals = React.useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    params.set("limit", "20");
    try {
      const res = await fetch(`/api/governance/proposals?${params}`);
      const data = await res.json() as { proposals?: Proposal[] };
      setProposals(data.proposals ?? []);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => { void fetchProposals(); }, [fetchProposals]);

  async function handleVote(proposalId: string, vote: string) {
    const res = await fetch(`/api/governance/proposals/${proposalId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) { toast.error(data.error ?? "Failed to vote"); return; }
    toast.success(`Vote recorded: ${vote}`);
    await fetchProposals();
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/governance/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to create proposal"); return; }
      toast.success("Proposal submitted!");
      setShowCreate(false);
      setForm({ title: "", description: "", category: "general", voting_days: 7 });
      await fetchProposals();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {(["open", "closed", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Proposal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Submit a Proposal</DialogTitle>
              <DialogDescription>
                Propose a change to the platform. The community will vote on it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  placeholder="Short, clear title…"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe the change and why it benefits the community…"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Voting period (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={form.voting_days}
                    onChange={(e) => setForm((p) => ({ ...p, voting_days: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={() => void handleCreate()} disabled={creating}>
                  {creating ? "Submitting…" : "Submit Proposal"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : proposals.length === 0 ? (
        <Card className="border-border/60 bg-card/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No {statusFilter !== "all" ? statusFilter : ""} proposals yet.
            {statusFilter === "open" && " Be the first to submit one!"}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} onVote={handleVote} />
          ))}
        </div>
      )}
    </div>
  );
}
