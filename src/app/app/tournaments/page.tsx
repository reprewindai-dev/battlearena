"use client";

import * as React from "react";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trophy, Plus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Tournament = {
  id: string;
  name: string;
  description: string;
  entry_fee_cents: number;
  prize_pool_cents: number;
  max_participants: number;
  status: "upcoming" | "active" | "completed" | "canceled";
  starts_at: string;
  ends_at: string;
  current_participants: number;
  created_by: string;
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isJoining, setIsJoining] = React.useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  
  const [createForm, setCreateForm] = React.useState({
    name: "",
    description: "",
    entry_fee_cents: 0,
    prize_pool_cents: 0,
    max_participants: 16,
    starts_at: "",
    ends_at: "",
    rules: "",
  });

  const supabase = createSupabaseBrowserClient();

  const fetchTournaments = React.useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Authentication required");
        return;
      }

      const response = await fetch("/api/tournaments", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (response.status === 403) {
        setError("Tournaments require an Enterprise subscription");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch tournaments");
      }

      const data = await response.json();
      setTournaments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tournaments");
    } finally {
      setIsLoading(false);
    }
  }, [supabase.auth]);

  React.useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  async function handleCreateTournament() {
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create tournament");
      }

      setShowCreateDialog(false);
      setCreateForm({
        name: "",
        description: "",
        entry_fee_cents: 0,
        prize_pool_cents: 0,
        max_participants: 16,
        starts_at: "",
        ends_at: "",
        rules: "",
      });
      
      await fetchTournaments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinTournament(tournamentId: string) {
    setIsJoining(tournamentId);
    try {
      // TODO: Implement tournament joining logic
      console.log("Joining tournament:", tournamentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join tournament");
    } finally {
      setIsJoining(null);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Tournaments Unavailable</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          {error.includes("Enterprise") && (
            <a href="/billing" className="text-primary hover:underline">
              Upgrade to Enterprise Plan
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8" />
            Tournaments
          </h1>
          <p className="text-muted-foreground">Compete in organized battles for prizes</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Tournament
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Tournament</DialogTitle>
              <DialogDescription>
                Set up a new battle tournament with entry fees and prizes
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tournament Name</Label>
                  <Input
                    id="name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
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
                    onChange={(e) => setCreateForm(prev => ({ ...prev, max_participants: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your tournament rules and format"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entry_fee">Entry Fee ($)</Label>
                  <Input
                    id="entry_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.entry_fee_cents / 100}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, entry_fee_cents: Math.round(parseFloat(e.target.value) * 100) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prize_pool">Prize Pool ($)</Label>
                  <Input
                    id="prize_pool"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.prize_pool_cents / 100}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, prize_pool_cents: Math.round(parseFloat(e.target.value) * 100) }))}
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
                    onChange={(e) => setCreateForm(prev => ({ ...prev, starts_at: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ends_at">End Date</Label>
                  <Input
                    id="ends_at"
                    type="datetime-local"
                    value={createForm.ends_at}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, ends_at: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rules">Rules (JSON)</Label>
                <Textarea
                  id="rules"
                  value={createForm.rules}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, rules: e.target.value }))}
                  placeholder='{"format": "single_elimination", "battle_duration": 300}'
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTournament} disabled={isCreating}>
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
              Be the first to create a tournament or check back later for upcoming events.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              onJoin={handleJoinTournament}
              isJoining={isJoining === tournament.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
