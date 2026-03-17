"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Zap } from "lucide-react";
import { toast } from "sonner";

type ChallengeTarget = {
  id: string;
  handle: string;
  display_name: string | null;
  elo_rating: number;
  tier: string;
};

export function ChallengeModal({
  target,
  open,
  onClose,
}: {
  target: ChallengeTarget | null;
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = React.useState("freestyle");
  const [wagerTokens, setWagerTokens] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit() {
    if (!target) return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        challenged_id: target.id,
        battle_mode: mode,
        message: message || undefined,
      };
      if (mode === "wager" && wagerTokens) {
        body.wager_tokens = parseInt(wagerTokens, 10);
      }

      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to send challenge");
        return;
      }

      toast.success(`Challenge sent to @${target.handle}!`);
      onClose();
      setMessage("");
      setWagerTokens("");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-400" />
            Challenge {target?.display_name ?? target?.handle}
          </DialogTitle>
          <DialogDescription>
            @{target?.handle} - ELO {target?.elo_rating} - {target?.tier?.toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Battle Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="freestyle">Freestyle</SelectItem>
                <SelectItem value="ranked">Ranked</SelectItem>
                <SelectItem value="wager">Wager</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "wager" && (
            <div className="space-y-2">
              <Label>Wager (tokens)</Label>
              <Input
                type="number"
                min="1"
                max="10000"
                placeholder="e.g. 100"
                value={wagerTokens}
                onChange={e => setWagerTokens(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea
              placeholder="Trash talk or respect - your choice."
              maxLength={280}
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">{message.length}/280</p>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
              {loading ? "Sending..." : "Send Challenge"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

