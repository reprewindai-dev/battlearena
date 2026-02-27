"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, CheckCircle } from "lucide-react";

interface TournamentRegisterButtonProps {
  tournamentId: string;
  entryFee: number;
  isRegistered: boolean;
  isOpen: boolean;
  status: string;
}

export function TournamentRegisterButton({
  tournamentId,
  entryFee,
  isRegistered: initialRegistered,
  isOpen,
  status,
}: TournamentRegisterButtonProps) {
  const [registered, setRegistered] = React.useState(initialRegistered);
  const [loading, setLoading] = React.useState(false);

  async function handleRegister() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Registration failed");
        return;
      }
      setRegistered(true);
      toast.success("Registered for tournament!");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (registered) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2">
        <CheckCircle className="h-4 w-4 text-green-400" />
        <span className="text-sm text-green-400 font-medium">Registered</span>
      </div>
    );
  }

  if (!isOpen) {
    const labels: Record<string, string> = {
      upcoming: "Registration Not Open",
      live: "In Progress",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return (
      <Badge variant="outline" className="text-muted-foreground px-4 py-2">
        {labels[status] ?? status}
      </Badge>
    );
  }

  return (
    <Button size="sm" onClick={handleRegister} disabled={loading} className="gap-2">
      {loading ? (
        "Registering…"
      ) : (
        <>
          Register
          {entryFee > 0 && (
            <span className="flex items-center gap-0.5 text-xs opacity-80">
              <Zap className="h-3 w-3" />
              {entryFee}
            </span>
          )}
        </>
      )}
    </Button>
  );
}
