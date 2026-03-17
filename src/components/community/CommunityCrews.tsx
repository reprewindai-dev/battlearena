"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Crew = {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  member_count: number;
  crew_level: number;
  is_member: boolean;
  member_role: string | null;
};

export function CommunityCrews() {
  const [items, setItems] = React.useState<Crew[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [busyCrewId, setBusyCrewId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/community/crews?limit=8");
      const json = (await res.json()) as { items?: Crew[]; error?: string };
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

  async function createCrew() {
    if (name.trim().length < 3) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/community/crews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "create_failed");
      }
      setName("");
      setDescription("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "create_failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function joinCrew(crewId: string) {
    setBusyCrewId(crewId);
    setError(null);
    try {
      const res = await fetch(`/api/community/crews/${crewId}/join`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "join_failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "join_failed");
    } finally {
      setBusyCrewId(null);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Crews</h3>
      <Card className="space-y-2 border-border/60 bg-card/30 p-3">
        <Input
          placeholder="Crew name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
        />
        <Textarea
          placeholder="Crew description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={280}
        />
        <Button onClick={createCrew} disabled={submitting || name.trim().length < 3} size="sm">
          {submitting ? "Creating..." : "Create Crew"}
        </Button>
      </Card>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading crews...</div>
      ) : (
        <div className="space-y-2">
          {items.map((crew) => (
            <Card key={crew.id} className="border-border/60 bg-card/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{crew.name}</div>
                  <div className="text-xs text-muted-foreground">#{crew.tag} - level {crew.crew_level}</div>
                  {crew.description ? <div className="mt-1 text-xs text-muted-foreground">{crew.description}</div> : null}
                  <div className="mt-1 text-xs text-muted-foreground">members {crew.member_count}</div>
                </div>
                {crew.is_member ? (
                  <span className="text-xs text-emerald-300">Joined{crew.member_role ? ` (${crew.member_role})` : ""}</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void joinCrew(crew.id)} disabled={busyCrewId === crew.id}>
                    {busyCrewId === crew.id ? "Joining..." : "Join"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {items.length === 0 ? <div className="text-xs text-muted-foreground">No crews yet.</div> : null}
        </div>
      )}

      {error ? <div className="text-xs text-amber-300">{error}</div> : null}
    </div>
  );
}

