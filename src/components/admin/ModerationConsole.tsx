"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Clock, Shield, TrendingUp, XCircle, FileText } from "lucide-react";

type ModerationCase = {
  id: string;
  reason: string;
  status: "open" | "in_review" | "resolved" | "escalated" | "closed";
  created_at: string;
  updated_at: string;
  subject_user_id: string | null;
  battle_id: string | null;
  created_by: string | null;
};

type ModerationAction = {
  id: string;
  action_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  actor_user_id: string;
};

type Stats = {
  open: number;
  in_review: number;
  resolved: number;
  escalated: number;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: "Open", color: "border-red-500/40 text-red-400", icon: <AlertTriangle className="h-3 w-3" /> },
  in_review: { label: "In Review", color: "border-yellow-500/40 text-yellow-400", icon: <Clock className="h-3 w-3" /> },
  resolved: { label: "Resolved", color: "border-green-500/40 text-green-400", icon: <CheckCircle className="h-3 w-3" /> },
  escalated: { label: "Escalated", color: "border-purple-500/40 text-purple-400", icon: <TrendingUp className="h-3 w-3" /> },
  closed: { label: "Closed", color: "border-muted-foreground/40 text-muted-foreground", icon: <XCircle className="h-3 w-3" /> },
};

const ACTION_LABELS: Record<string, string> = {
  warn: "⚠️ Warn User",
  mute: "🔇 Mute User",
  ban: "🚫 Ban User",
  remove_content: "🗑️ Remove Content",
  dismiss: "✅ Dismiss",
  escalate: "⬆️ Escalate",
  close: "🔒 Close",
  note: "📝 Add Note",
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="border-border/60 bg-card/30 p-4">
      <div className="text-2xl font-black">{value}</div>
      <div className={`mt-0.5 text-xs font-medium ${color}`}>{label}</div>
    </Card>
  );
}

function CaseRow({
  modCase,
  onClick,
}: {
  modCase: ModerationCase;
  onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[modCase.status] ?? STATUS_CONFIG.open;
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/30 p-4 text-left transition-colors hover:bg-card/60"
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium">{modCase.reason}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {modCase.subject_user_id && (
            <span className="font-mono">User: {modCase.subject_user_id.slice(0, 8)}…</span>
          )}
          {modCase.battle_id && (
            <span className="font-mono">Battle: {modCase.battle_id.slice(0, 8)}…</span>
          )}
          <span>{formatDistanceToNow(modCase.created_at)}</span>
        </div>
      </div>
      <Badge variant="outline" className={`shrink-0 flex items-center gap-1 ${cfg.color}`}>
        {cfg.icon} {cfg.label}
      </Badge>
    </button>
  );
}

function CaseDetailModal({
  caseId,
  open,
  onClose,
  onUpdate,
}: {
  caseId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [modCase, setModCase] = React.useState<ModerationCase | null>(null);
  const [actions, setActions] = React.useState<ModerationAction[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [actionType, setActionType] = React.useState<string>("");
  const [note, setNote] = React.useState("");
  const [newStatus, setNewStatus] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!caseId || !open) return;
    setLoading(true);
    fetch(`/api/moderation/cases/${caseId}`)
      .then(r => r.json())
      .then(data => {
        setModCase(data.case ?? null);
        setActions(data.actions ?? []);
        setNewStatus(data.case?.status ?? "");
      })
      .catch(() => toast.error("Failed to load case"))
      .finally(() => setLoading(false));
  }, [caseId, open]);

  async function handleSubmit() {
    if (!caseId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/moderation/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(newStatus !== modCase?.status ? { status: newStatus } : {}),
          ...(actionType ? { action_type: actionType } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Action failed");
        return;
      }
      toast.success("Case updated");
      setModCase(json.case);
      setNote("");
      setActionType("");
      onUpdate();
      // Re-fetch actions
      fetch(`/api/moderation/cases/${caseId}`)
        .then(r => r.json())
        .then(d => setActions(d.actions ?? []));
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Case Details
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded bg-muted/30" />
            <div className="h-12 animate-pulse rounded bg-muted/30" />
          </div>
        ) : modCase ? (
          <div className="space-y-4">
            {/* Case info */}
            <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
              <p className="font-medium">{modCase.reason}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Status: <span className="text-foreground font-medium">{modCase.status}</span></div>
                <div>Opened: {formatDistanceToNow(modCase.created_at)}</div>
                {modCase.subject_user_id && <div className="col-span-2 font-mono">User: {modCase.subject_user_id}</div>}
                {modCase.battle_id && <div className="col-span-2 font-mono">Battle: {modCase.battle_id}</div>}
              </div>
            </div>

            {/* Action history */}
            {actions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action History</p>
                <div className="max-h-36 space-y-1.5 overflow-y-auto">
                  {actions.map(a => (
                    <div key={a.id} className="flex items-start justify-between gap-2 rounded border border-border/40 bg-muted/10 px-3 py-2 text-xs">
                      <div>
                        <span className="font-medium">{ACTION_LABELS[a.action_type] ?? a.action_type}</span>
                        {a.payload?.note && <span className="ml-2 text-muted-foreground">— {a.payload.note as string}</span>}
                      </div>
                      <span className="shrink-0 text-muted-foreground">{formatDistanceToNow(a.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Take action */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Take Action</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Update Status</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                        <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Action Type</label>
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Action (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Textarea
                placeholder="Optional note or reason for this action…"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="h-20 text-sm"
              />

              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || (!actionType && !note.trim() && newStatus === modCase.status)}
                className="w-full"
              >
                {submitting ? "Saving…" : "Submit Action"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Case not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ModerationConsole() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [cases, setCases] = React.useState<ModerationCase[]>([]);
  const [statusFilter, setStatusFilter] = React.useState("open");
  const [page, setPage] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [selectedCaseId, setSelectedCaseId] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const [statsRes, casesRes] = await Promise.all([
        fetch("/api/moderation/stats"),
        fetch(`/api/moderation/cases?status=${statusFilter}&page=${page}`),
      ]);
      const [statsData, casesData] = await Promise.all([statsRes.json(), casesRes.json()]);
      setStats(statsData);
      setCases(casesData.cases ?? []);
      setTotalPages(casesData.pages ?? 1);
      setTotal(casesData.total ?? 0);
    } catch {
      toast.error("Failed to load moderation data");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { fetchData(); }, [statusFilter, page]);

  function openCase(id: string) {
    setSelectedCaseId(id);
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Open" value={stats.open} color="text-red-400" />
          <StatCard label="In Review" value={stats.in_review} color="text-yellow-400" />
          <StatCard label="Escalated" value={stats.escalated} color="text-purple-400" />
          <StatCard label="Resolved" value={stats.resolved} color="text-green-400" />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
          <Button
            key={val}
            size="sm"
            variant={statusFilter === val ? "default" : "outline"}
            onClick={() => { setStatusFilter(val); setPage(0); }}
          >
            {cfg.label}
          </Button>
        ))}
        <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => { setStatusFilter("all"); setPage(0); }}>
          All ({total})
        </Button>
      </div>

      {/* Case list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/30" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <Card className="border-border/60 bg-card/30 p-10 text-center">
          <Shield className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-2 text-sm text-muted-foreground">
            No {statusFilter === "all" ? "" : statusFilter} cases.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {cases.map(c => (
            <CaseRow key={c.id} modCase={c} onClick={() => openCase(c.id)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Case detail modal */}
      <CaseDetailModal
        caseId={selectedCaseId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdate={fetchData}
      />
    </div>
  );
}
