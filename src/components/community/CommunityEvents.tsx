"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  status: string;
  attendee_count: number;
  max_attendees: number;
  is_registered: boolean;
  host: { username: string | null } | null;
};

function toLocalDatetimeInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CommunityEvents() {
  const [items, setItems] = React.useState<EventItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [startsAt, setStartsAt] = React.useState(() => toLocalDatetimeInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [submitting, setSubmitting] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/community/events?limit=8");
      const json = (await res.json()) as { items?: EventItem[]; error?: string };
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

  async function createEvent() {
    if (title.trim().length < 3) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/community/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          startsAt: new Date(startsAt).toISOString(),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "create_failed");
      }
      setTitle("");
      setDescription("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "create_failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function joinEvent(eventId: string) {
    setBusyId(eventId);
    setError(null);
    try {
      const res = await fetch(`/api/community/events/${eventId}/join`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "join_failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "join_failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Community Events</h3>

      <Card className="space-y-2 border-border/60 bg-card/30 p-3">
        <Input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <Textarea
          placeholder="Event description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={280}
        />
        <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        <Button size="sm" onClick={createEvent} disabled={submitting || title.trim().length < 3}>
          {submitting ? "Creating..." : "Create Event"}
        </Button>
      </Card>

      {loading ? <div className="text-xs text-muted-foreground">Loading events...</div> : null}
      {!loading && items.length === 0 ? <div className="text-xs text-muted-foreground">No upcoming events.</div> : null}
      {!loading && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((event) => (
            <Card key={event.id} className="border-border/60 bg-card/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{event.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(event.starts_at).toLocaleString()} - {event.status}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    host: {(event.host?.username ?? "unknown").toString()}
                  </div>
                  {event.description ? <div className="mt-1 text-xs text-muted-foreground">{event.description}</div> : null}
                  <div className="mt-1 text-xs text-muted-foreground">
                    attendees {event.attendee_count}/{event.max_attendees}
                  </div>
                </div>
                {event.is_registered ? (
                  <span className="text-xs text-emerald-300">Registered</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void joinEvent(event.id)} disabled={busyId === event.id}>
                    {busyId === event.id ? "Joining..." : "Join"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {error ? <div className="text-xs text-amber-300">{error}</div> : null}
    </div>
  );
}

