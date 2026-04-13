"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Mentorship = {
  id: string;
  mentor_id: string;
  mentee_id: string;
  status: "pending" | "accepted" | "declined" | "completed" | "cancelled";
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  mentor: { username: string | null } | null;
  mentee: { username: string | null } | null;
};

const ACTION_STATUSES: Array<Mentorship["status"]> = ["accepted", "declined", "completed", "cancelled"];

export function CommunityMentorships() {
  const [items, setItems] = React.useState<Mentorship[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [mentorHandle, setMentorHandle] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/community/mentorships");
      const json = (await res.json()) as { items?: Mentorship[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "load_failed");
      }
      setItems(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function requestMentorship() {
    if (!mentorHandle.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/community/mentorships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mentorHandle: mentorHandle.trim().toLowerCase(),
          note: note.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "request_failed");
      }
      setMentorHandle("");
      setNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "request_failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: Mentorship["status"]) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/community/mentorships/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "status_update_failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "status_update_failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Mentorship</h3>

      <Card className="space-y-2 border-border/60 bg-card/30 p-3">
        <Input
          placeholder="Mentor handle (without @)"
          value={mentorHandle}
          onChange={(e) => setMentorHandle(e.target.value)}
        />
        <Textarea
          placeholder="Optional note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={280}
        />
        <Button size="sm" onClick={requestMentorship} disabled={submitting || !mentorHandle.trim()}>
          {submitting ? "Requesting..." : "Request Mentorship"}
        </Button>
      </Card>

      {loading ? <div className="text-xs text-muted-foreground">Loading mentorships...</div> : null}
      {!loading && items.length === 0 ? <div className="text-xs text-muted-foreground">No mentorship requests yet.</div> : null}
      {!loading && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="border-border/60 bg-card/30 p-3">
              <div className="text-sm font-medium">
                {(item.mentor?.username ?? item.mentor_id).toString()} {"->"} {(item.mentee?.username ?? item.mentee_id).toString()}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">status: {item.status}</div>
              {item.notes ? <div className="mt-1 text-xs text-muted-foreground">{item.notes}</div> : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {ACTION_STATUSES.map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant="outline"
                    onClick={() => void updateStatus(item.id, status)}
                    disabled={busyId === item.id || item.status === status}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {error ? <div className="text-xs text-amber-300">{error}</div> : null}
    </div>
  );
}
