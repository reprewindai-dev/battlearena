"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trophy } from "lucide-react";
import { toast } from "sonner";

import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TournamentStatus = "upcoming" | "registration" | "live" | "completed" | "cancelled";

type TournamentListItem = {
  id: string;
  name: string;
  description: string | null;
  status: TournamentStatus;
  format: string;
  max_participants: number;
  tournament_type: string | null;
  entry_fee_tokens: number;
  prize_pool_tokens: number;
  starts_at: string | null;
  registration_closes: string | null;
  registration_opens: string | null;
  created_at: string;
  created_by: string | null;
  participant_count: Array<{ count: number }> | null;
  registration_ends_at?: string | null;
};

type TournamentsResponse = {
  tournaments: TournamentListItem[];
  total: number;
};

type CreateTournamentForm = {
  name: string;
  description: string;
  format: string;
  tournament_type: string;
  max_participants: number;
  entry_fee_tokens: number;
  prize_pool_tokens: number;
  starts_at: string;
  registration_ends_at: string;
};

const initialCreateForm: CreateTournamentForm = {
  name: "",
  description: "",
  format: "single_elimination",
  tournament_type: "open",
  max_participants: 16,
  entry_fee_tokens: 0,
  prize_pool_tokens: 0,
  starts_at: "",
  registration_ends_at: "",
};

export default function TournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = React.useState<TournamentListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isJoining, setIsJoining] = React.useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<CreateTournamentForm>(initialCreateForm);

  const fetchTournaments = React.useCallback(async () => {
    try {
      const response = await fetch("/api/tournaments", {
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to fetch tournaments");
      }

      const data = (await response.json()) as TournamentsResponse;
      setTournaments(data.tournaments ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tournaments");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchTournaments();
  }, [fetchTournaments]);

  async function handleCreateTournament() {
    setIsCreating(true);
    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createForm),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; tournament?: { id?: string } }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to create tournament");
      }

      setShowCreateDialog(false);
      setCreateForm(initialCreateForm);
      toast.success("Tournament created.");
      await fetchTournaments();

      if (payload?.tournament?.id) {
        router.push(`/app/tournaments/${encodeURIComponent(payload.tournament.id)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create tournament";
      setError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinTournament(tournamentId: string) {
    setIsJoining(tournamentId);
    try {
      const response = await fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/register`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to join tournament");
      }

      toast.success("Tournament registration complete.");
      await fetchTournaments();
      router.push(`/app/tournaments/${encodeURIComponent(tournamentId)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join tournament";
      setError(message);
      toast.error(message);
    } finally {
      setIsJoining(null);
    }
  }

  function handleViewTournament(tournamentId: string) {
    router.push(`/app/tournaments/${encodeURIComponent(tournamentId)}`);
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-muted" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="py-12 text-center">
          <h2 className="mb-2 text-2xl font-bold">Tournaments Unavailable</h2>
          <p className="mb-4 text-muted-foreground">{error}</p>
          <Button onClick={() => void fetchTournaments()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Trophy className="h-8 w-8" />
            Tournaments
          </h1>
          <p className="text-muted-foreground">Compete in organized battles for prizes.</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Tournament
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Tournament</DialogTitle>
              <DialogDescription>
                Create a tournament with real registration windows, token entry, and prize pool configuration.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tournament Name</Label>
                  <Input
                    id="name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Summer Battle Championship"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_participants">Max Participants</Label>
                  <Input
                    id="max_participants"
                    type="number"
                    min="4"
                    max="64"
                    value={createForm.max_participants}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        max_participants: Number.parseInt(e.target.value || "0", 10) || 4,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your tournament rules and format"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entry_fee_tokens">Entry Fee (tokens)</Label>
                  <Input
                    id="entry_fee_tokens"
                    type="number"
                    min="0"
                    step="1"
                    value={createForm.entry_fee_tokens}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        entry_fee_tokens: Number.parseInt(e.target.value || "0", 10) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prize_pool_tokens">Prize Pool (tokens)</Label>
                  <Input
                    id="prize_pool_tokens"
                    type="number"
                    min="0"
                    step="1"
                    value={createForm.prize_pool_tokens}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        prize_pool_tokens: Number.parseInt(e.target.value || "0", 10) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="starts_at">Start Date</Label>
                  <Input
                    id="starts_at"
                    type="datetime-local"
                    value={createForm.starts_at}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, starts_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registration_ends_at">Registration Closes</Label>
                  <Input
                    id="registration_ends_at"
                    type="datetime-local"
                    value={createForm.registration_ends_at}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, registration_ends_at: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleCreateTournament()} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Tournament"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tournaments.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Tournaments</CardTitle>
            <CardDescription>
              No open tournaments yet. Create one or check back for upcoming events.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              onJoin={handleJoinTournament}
              onView={handleViewTournament}
              isJoining={isJoining === tournament.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
