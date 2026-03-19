"use client";

import * as React from "react";

import { useRouter, useSearchParams } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { VideoBattleProduction } from "@/components/battle/VideoBattleProduction";
import { useBattleSessionStore, type BattleSessionMode } from "@/lib/battle/session-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { trackUsage, checkUsageLimit } from "@/lib/usage/tracker";

type BattleParticipant = {
  user_id: string;
  slot: number;
  score: number | null;
  handle?: string | null;
  display_name?: string | null;
};

type BattleSessionMetadata = {
  id: string;
  status: string;
  mode: string;
  created_by?: string | null;
  viewer_user_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string | null;
  can_manage?: boolean;
  viewer_role?: string | null;
  current_round?: number | null;
  voting_opened_at?: string | null;
  voting_closes_at?: string | null;
  result?: unknown | null;
  participants: BattleParticipant[];
};

type FinalizeApiOk = {
  ok: true;
  mode: "supabase";
  battleId: string;
  result: {
    battle_id: string;
    winner_slot?: number | null;
    final_scores?: { 1: number; 2: number } | null;
  };
};

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

type Beat = {
  id: string;
  title: string;
  artist: string;
  tempo: number;
  genre: string;
  duration_seconds: number | null;
  preview_url: string | null;
};
type MicStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported" | "error";

type ChatMessage = { id: string; author: string; body: string; ts: number };

type SessionRole = "user" | "mod" | "admin";

type RecordingRow = {
  id: string;
  storage_bucket: string | null;
  storage_path: string | null;
  uploaded_at?: string | null;
  created_at?: string;
  mime_type?: string | null;
  duration_seconds?: number | null;
  bytes?: number | null;
  note?: string | null;
};

export function BattleRoomCockpit() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const storedBattleId = useBattleSessionStore((s) => s.battleId);
  const storedMode = useBattleSessionStore((s) => s.mode);
  const setStoredSession = useBattleSessionStore((s) => s.setSession);
  const clearStoredSession = useBattleSessionStore((s) => s.clear);

  const [round] = React.useState(1);
  const [latencyMs] = React.useState<number | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [sessionMode, setSessionMode] = React.useState<"supabase" | null>(null);
  const [viewerUserIdFallback, setViewerUserIdFallback] = React.useState<string | null>(null);
  const [sessionError, setSessionError] = React.useState<string | null>(null);
  const [autoCreateEnabled, setAutoCreateEnabled] = React.useState(true);

  const [sessionMeta, setSessionMeta] = React.useState<BattleSessionMetadata | null>(null);
  const [sessionMetaError, setSessionMetaError] = React.useState<string | null>(null);
  const [joinError, setJoinError] = React.useState<string | null>(null);
  const [isJoining, setIsJoining] = React.useState(false);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [finalizeError, setFinalizeError] = React.useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = React.useState(false);
  const [finalizeInfo, setFinalizeInfo] = React.useState<FinalizeApiOk | null>(null);
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    let cancelled = false;

    async function loadViewerUser() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (!cancelled) {
          setViewerUserIdFallback(data.user?.id ?? null);
        }
      } catch {
        if (!cancelled) {
          setViewerUserIdFallback(null);
        }
      }
    }

    void loadViewerUser();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const urlBattleId = searchParams.get("battleId");
    const resolvedId = urlBattleId ?? storedBattleId;
    const resolvedMode: BattleSessionMode | null = storedMode;

    if (resolvedId) {
      setSessionId(resolvedId);
      setSessionMode(resolvedMode ?? "supabase");
      setSessionError(null);

      if (!urlBattleId) {
        const next = new URLSearchParams(searchParams.toString());
        next.set("battleId", resolvedId);
        router.replace(`/app/battles/room?${next.toString()}`);
      }
      if (!storedBattleId || storedBattleId !== resolvedId) {
        setStoredSession({
          battleId: resolvedId,
          mode: "supabase" as BattleSessionMode,
        });
      }
      return () => {
        cancelled = true;
      };
    }

    if (!autoCreateEnabled) {
      return () => {
        cancelled = true;
      };
    }

    async function ensureSession() {
      try {
        // Check usage limit before creating battle
        const canCreate = await checkUsageLimit("battle_created");
        if (!canCreate) {
          setSessionError("Battle limit reached. Upgrade your plan to create more battles.");
          return;
        }

        const res = await fetch("/api/battle-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
        });
        const body = (await res.json()) as
          | { ok: true; mode: "supabase"; battleId: string }
          | { error: string; details?: string };
        if (cancelled) return;

        if (!res.ok || !("ok" in body)) {
          setSessionError("Unable to create battle session.");
          return;
        }

        setSessionId(body.battleId);
        setSessionMode(body.mode);
        setStoredSession({ battleId: body.battleId, mode: body.mode });

        // Track battle creation
        await trackUsage("battle_created", { battleId: body.battleId });

        const next = new URLSearchParams(searchParams.toString());
        next.set("battleId", body.battleId);
        router.replace(`/app/battles/room?${next.toString()}`);
      } catch {
        if (cancelled) return;
        setSessionError("Unable to create battle session.");
      }
    }

    void ensureSession();
    return () => {
      cancelled = true;
    };
  }, [autoCreateEnabled, router, searchParams, setStoredSession, storedBattleId, storedMode]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      if (!sessionId) {
        setSessionMeta(null);
        setSessionMetaError(null);
        return;
      }

      try {
        const url = `/api/battle-session?battleId=${encodeURIComponent(sessionId)}`;
        const res = await fetch(url, { method: "GET" });
        const body = (await res.json()) as
          | { ok: true; mode: "supabase"; session: BattleSessionMetadata }
          | { error: string; details?: string };

        if (cancelled) return;

        if (!res.ok || !("ok" in body)) {
          setSessionMeta(null);
          setSessionMetaError("Unable to load battle metadata.");
          return;
        }

        setSessionMeta(body.session);
        setSessionMetaError(null);
      } catch {
        if (cancelled) return;
        setSessionMeta(null);
        setSessionMetaError("Unable to load battle metadata.");
      }
    }

    void loadMeta();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function joinAsB() {
    if (!sessionId) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await fetch("/api/battle-session/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ battleId: sessionId }),
      });

      if (!res.ok) {
        setJoinError("Unable to join battle.");
        return;
      }

      const url = `/api/battle-session?battleId=${encodeURIComponent(sessionId)}`;
      const metaRes = await fetch(url, { method: "GET" });
      const metaBody = (await metaRes.json()) as
        | { ok: true; mode: "supabase"; session: BattleSessionMetadata }
        | { error: string; details?: string };

      if (!metaRes.ok || !("ok" in metaBody)) {
        setJoinError("Joined, but unable to refresh battle metadata.");
        return;
      }

      setSessionMeta(metaBody.session);
    } catch {
      setJoinError("Unable to join battle.");
    } finally {
      setIsJoining(false);
    }
  }

  async function updateBattleStatus(status: "live" | "complete") {
    if (!sessionId) return;
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      const res = await fetch("/api/battle-session/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ battleId: sessionId, status }),
      });

      if (!res.ok) {
        setStatusError("Unable to update battle status.");
        return;
      }

      const url = `/api/battle-session?battleId=${encodeURIComponent(sessionId)}`;
      const metaRes = await fetch(url, { method: "GET" });
      const metaBody = (await metaRes.json()) as
        | { ok: true; mode: "supabase"; session: BattleSessionMetadata }
        | { error: string; details?: string };

      if (!metaRes.ok || !("ok" in metaBody)) {
        setStatusError("Updated, but unable to refresh battle metadata.");
        return;
      }

      setSessionMeta(metaBody.session);
    } catch {
      setStatusError("Unable to update battle status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function finalizeBattle() {
    if (!sessionId) return;
    setIsFinalizing(true);
    setFinalizeError(null);
    setFinalizeInfo(null);
    try {
      const res = await fetch("/api/battle-session/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ battleId: sessionId }),
      });

      const body = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const details =
          body && typeof body === "object" && body && "details" in body
            ? String((body as { details?: unknown }).details)
            : null;
        setFinalizeError(details ? `Unable to finalize battle: ${details}` : "Unable to finalize battle.");
        return;
      }

      if (body && typeof body === "object" && "ok" in body && (body as { ok?: unknown }).ok === true) {
        setFinalizeInfo(body as FinalizeApiOk);
      }

      const url = `/api/battle-session?battleId=${encodeURIComponent(sessionId)}`;
      const metaRes = await fetch(url, { method: "GET" });
      const metaBody = (await metaRes.json()) as
        | { ok: true; mode: "supabase"; session: BattleSessionMetadata }
        | { error: string; details?: string };

      if (!metaRes.ok || !("ok" in metaBody)) {
        setFinalizeError("Finalized, but unable to refresh battle metadata.");
        return;
      }

      setSessionMeta(metaBody.session);
    } catch {
      setFinalizeError("Unable to finalize battle.");
    } finally {
      setIsFinalizing(false);
    }
  }

  const derivedResult =
    (finalizeInfo?.result as unknown) ?? (sessionMeta?.result as unknown) ?? null;

  const counts =
    derivedResult && typeof derivedResult === "object" && "counts" in derivedResult
      ? ((derivedResult as { counts?: Record<string, number> }).counts ?? null)
      : null;

  const winnerSlot =
    derivedResult && typeof derivedResult === "object" && "winner_slot" in derivedResult
      ? ((derivedResult as { winner_slot?: number | null }).winner_slot ?? null)
      : null;

  const votingClosesAt = sessionMeta?.voting_closes_at ?? null;
  const votingClosesMs = votingClosesAt ? new Date(votingClosesAt).getTime() : null;
  const votingRemainingSeconds = votingClosesMs
    ? Math.max(0, Math.floor((votingClosesMs - nowMs) / 1000))
    : null;
  const votingClosed =
    sessionMode === "supabase" && (votingRemainingSeconds === null || votingRemainingSeconds <= 0);

  const battleStatus = sessionMeta?.status ?? "--";
  const statusBadge =
    battleStatus === "live"
      ? { label: `LIVE (${sessionMode ?? "..."})`, className: "bg-emerald-500/15 text-emerald-200" }
      : battleStatus === "queued" || battleStatus === "draft"
        ? { label: `${battleStatus.toUpperCase()} (${sessionMode ?? "..."})`, className: "bg-amber-500/15 text-amber-200" }
        : battleStatus === "complete"
          ? { label: `COMPLETE (${sessionMode ?? "..."})`, className: "bg-slate-500/20 text-slate-200" }
          : battleStatus === "canceled"
            ? { label: `CANCELED (${sessionMode ?? "..."})`, className: "bg-slate-500/20 text-slate-200" }
            : { label: `${battleStatus.toUpperCase()} (${sessionMode ?? "..."})`, className: "bg-slate-500/20 text-slate-200" };

  function leaveBattle() {
    clearStoredSession();
    setSessionId(null);
    setSessionMode(null);
    setSessionError(null);
    setAutoCreateEnabled(false);
    router.replace("/app/battles/room");
  }

  function startNewBattle() {
    setAutoCreateEnabled(true);
  }

  const slotA = sessionMeta?.participants?.find((p) => p.slot === 1) ?? null;
  const slotB = sessionMeta?.participants?.find((p) => p.slot === 2) ?? null;
  const viewerUserId = sessionMeta?.viewer_user_id ?? viewerUserIdFallback;
  const localSlot = slotA?.user_id === viewerUserId ? 1 : slotB?.user_id === viewerUserId ? 2 : 1;
  const showJoinAsB = Boolean(sessionId && !slotB);

  function formatParticipantLabel(p: BattleParticipant | null) {
    if (!p) return "--------";
    const label = p.display_name ?? p.handle;
    if (label && label.trim().length > 0) return label;
    return p.user_id.slice(0, 8);
  }

  const [countdownSeconds, setCountdownSeconds] = React.useState(10);
  React.useEffect(() => {
    const t = window.setInterval(() => {
      setCountdownSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  const [beatModalOpen, setBeatModalOpen] = React.useState(false);
  const [currentBeat, setCurrentBeat] = React.useState<Beat | null>(null);
  const [beatPlaying, setBeatPlaying] = React.useState(false);
  const [beatLibrary, setBeatLibrary] = React.useState<Beat[]>([]);
  const [beatSearch, setBeatSearch] = React.useState("");
  const [beatsLoading, setBeatsLoading] = React.useState(false);
  const [beatLoadError, setBeatLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!beatModalOpen) return;

    let cancelled = false;

    async function loadBeatLibrary() {
      setBeatsLoading(true);
      setBeatLoadError(null);

      try {
        const res = await fetch("/api/beats?limit=40&sort_by=usage_count&sort_order=desc");
        const body = (await res.json()) as
          | { ok: true; beats: Beat[] }
          | { error: string; details?: string };

        if (cancelled) return;
        if (!res.ok || !("ok" in body)) {
          const details = "details" in body && typeof body.details === "string" ? body.details : null;
          setBeatLoadError(details ? `Unable to load beats: ${details}` : "Unable to load beats.");
          return;
        }

        setBeatLibrary(body.beats);
      } catch {
        if (cancelled) return;
        setBeatLoadError("Unable to load beats.");
      } finally {
        if (!cancelled) {
          setBeatsLoading(false);
        }
      }
    }

    void loadBeatLibrary();
    return () => {
      cancelled = true;
    };
  }, [beatModalOpen]);

  const visibleBeats = React.useMemo(() => {
    const needle = beatSearch.trim().toLowerCase();
    if (!needle) return beatLibrary;
    return beatLibrary.filter((beat) => {
      return (
        beat.title.toLowerCase().includes(needle) ||
        beat.artist.toLowerCase().includes(needle) ||
        beat.genre.toLowerCase().includes(needle)
      );
    });
  }, [beatLibrary, beatSearch]);

  const [micStatus, setMicStatus] = React.useState<MicStatus>("idle");
  const [isClient, setIsClient] = React.useState(false);

  // FIX: Initialize mic status only on client side
  React.useEffect(() => {
    setIsClient(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus("unsupported");
    } else if (typeof MediaRecorder === "undefined") {
      setMicStatus("unsupported");
    }
  }, []);
  const [micError, setMicError] = React.useState<string | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const [recordingState, setRecordingState] = React.useState<"idle" | "recording" | "stopped" | "playing">(
    "idle",
  );
  const [recordingSeconds, setRecordingSeconds] = React.useState(0);
  const [recordingBlob, setRecordingBlob] = React.useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    if (recordingState !== "recording") return;
    const t = window.setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [recordingState]);

  React.useEffect(() => {
    return () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
    };
  }, [recordingUrl]);

  React.useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const [messages, setMessages] = React.useState<ChatMessage[]>([
    { id: "m1", author: "System", body: "Battle session started.", ts: 0 },
  ]);
  const [chatDraft, setChatDraft] = React.useState("");
  const [onlineCount, setOnlineCount] = React.useState<number | null>(null);
  const [typingUserIds, setTypingUserIds] = React.useState<string[]>([]);

  const [voteA, setVoteA] = React.useState(0);
  const [voteB, setVoteB] = React.useState(0);
  const [hasVoted, setHasVoted] = React.useState(false);
  const [myVote, setMyVote] = React.useState<1 | 2 | null>(null);
  const [chatError, setChatError] = React.useState<string | null>(null);
  const [voteError, setVoteError] = React.useState<string | null>(null);
  const [recordingsCount, setRecordingsCount] = React.useState<number | null>(null);
  const [recordings, setRecordings] = React.useState<RecordingRow[]>([]);
  const [latestRecordingId, setLatestRecordingId] = React.useState<string | null>(null);
  const [recordingUploadError, setRecordingUploadError] = React.useState<string | null>(null);
  const [isUploadingRecording, setIsUploadingRecording] = React.useState(false);
  const [playbackError, setPlaybackError] = React.useState<string | null>(null);
  const [isPlayingPersisted, setIsPlayingPersisted] = React.useState(false);
  const [sessionRole, setSessionRole] = React.useState<SessionRole>("user");
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletingRecordingId, setDeletingRecordingId] = React.useState<string | null>(null);
  const lastRecordingsSnapshotRef = React.useRef<RecordingRow[] | null>(null);
  const realtimeChannelRef = React.useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = React.useRef<number | null>(null);

  const isSupabaseMode = sessionMode === "supabase";

  const reloadMessages = React.useCallback(async () => {
    if (!sessionId || !isSupabaseMode) return;
    const res = await fetch(`/api/battle-session/messages?battleId=${encodeURIComponent(sessionId)}`);
    const body = (await res.json()) as
      | { ok: true; mode: "supabase"; messages: ChatMessage[] }
      | { error: string; details?: string };
    if (res.ok && "ok" in body) {
      setMessages(body.messages);
      setChatError(null);
    } else {
      setChatError("Unable to load chat.");
    }
  }, [isSupabaseMode, sessionId]);

  const reloadVotes = React.useCallback(async () => {
    if (!sessionId || !isSupabaseMode) return;
    const res = await fetch(`/api/battle-session/votes?battleId=${encodeURIComponent(sessionId)}`);
    const body = (await res.json()) as
      | { ok: true; mode: "supabase"; counts: { 1: number; 2: number }; my_vote: 1 | 2 | null }
      | { error: string; details?: string };
    if (res.ok && "ok" in body) {
      setVoteA(body.counts[1]);
      setVoteB(body.counts[2]);
      setMyVote(body.my_vote);
      setHasVoted(Boolean(body.my_vote));
      setVoteError(null);
    } else {
      setVoteError("Unable to load votes.");
    }
  }, [isSupabaseMode, sessionId]);

  const reloadRecordings = React.useCallback(async () => {
    if (!sessionId || !isSupabaseMode) return;
    const res = await fetch(`/api/battle-session/recordings?battleId=${encodeURIComponent(sessionId)}`);
    const body = (await res.json()) as
      | { ok: true; mode: "supabase"; recordings: RecordingRow[] }
      | { error: string; details?: string };
    if (res.ok && "ok" in body) {
      setRecordings(body.recordings);
      const finalized = body.recordings.filter((r) => r.storage_bucket && r.storage_path && r.uploaded_at);
      setRecordingsCount(finalized.length);
      setLatestRecordingId(finalized.at(-1)?.id ?? null);
    }
  }, [isSupabaseMode, sessionId]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadChatAndVotes() {
      if (!sessionId || !isSupabaseMode) return;

      try {
        const [messagesRes, votesRes] = await Promise.all([
          fetch(`/api/battle-session/messages?battleId=${encodeURIComponent(sessionId)}`),
          fetch(`/api/battle-session/votes?battleId=${encodeURIComponent(sessionId)}`),
        ]);

        const messagesBody = (await messagesRes.json()) as
          | { ok: true; mode: "supabase"; messages: ChatMessage[] }
          | { error: string; details?: string };
        const votesBody = (await votesRes.json()) as
          | { ok: true; mode: "supabase"; counts: { 1: number; 2: number }; my_vote: 1 | 2 | null }
          | { error: string; details?: string };

        if (cancelled) return;

        if (messagesRes.ok && "ok" in messagesBody) {
          setMessages(messagesBody.messages);
          setChatError(null);
        } else {
          setChatError("Unable to load chat.");
        }

        if (votesRes.ok && "ok" in votesBody) {
          setVoteA(votesBody.counts[1]);
          setVoteB(votesBody.counts[2]);
          setMyVote(votesBody.my_vote);
          setHasVoted(Boolean(votesBody.my_vote));
          setVoteError(null);
        } else {
          setVoteError("Unable to load votes.");
        }
      } catch {
        if (cancelled) return;
        setChatError("Unable to load chat.");
        setVoteError("Unable to load votes.");
      }
    }

    void loadChatAndVotes();
    return () => {
      cancelled = true;
    };
  }, [isSupabaseMode, sessionId]);

  React.useEffect(() => {
    if (!sessionId || !isSupabaseMode) return;
    void reloadRecordings();
  }, [isSupabaseMode, reloadRecordings, sessionId]);

  React.useEffect(() => {
    const role = sessionMeta?.viewer_role;
    if (role === "admin" || role === "mod" || role === "user") {
      setSessionRole(role);
    }
  }, [sessionMeta?.viewer_role]);

  React.useEffect(() => {
    if (!sessionId || !isSupabaseMode) return;

    let supabase: ReturnType<typeof createSupabaseBrowserClient> | null = null;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const userId = viewerUserId ?? null;
    const presenceKey = userId ?? crypto.randomUUID();

    const channel = supabase
      .channel(`battle_${sessionId}`, {
        config: {
          presence: {
            key: presenceKey,
          },
        },
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setOnlineCount(count);
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        const userId = (payload as { payload?: unknown } | null)?.payload;
        if (!userId || typeof userId !== "string") return;
        setTypingUserIds((prev) => {
          if (prev.includes(userId)) return prev;
          return [...prev, userId];
        });
        window.setTimeout(() => {
          setTypingUserIds((prev) => prev.filter((id) => id !== userId));
        }, 2500);
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "battle_messages",
          filter: `battle_id=eq.${sessionId}`,
        },
        () => {
          void reloadMessages();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "battle_votes",
          filter: `battle_id=eq.${sessionId}`,
        },
        () => {
          void reloadVotes();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "battle_recordings",
          filter: `battle_id=eq.${sessionId}`,
        },
        () => {
          void reloadRecordings();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "battle_recordings",
          filter: `battle_id=eq.${sessionId}`,
        },
        () => {
          void reloadRecordings();
        },
      )
      .subscribe();

    realtimeChannelRef.current = channel;
    void channel.track({ user_id: userId ?? presenceKey });

    return () => {
      realtimeChannelRef.current = null;
      try {
        void supabase?.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [isSupabaseMode, reloadMessages, reloadRecordings, reloadVotes, sessionId, viewerUserId]);

  React.useEffect(() => {
    if (!isSupabaseMode || !sessionId) return;
    const userId = viewerUserId;
    if (!userId) return;

    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      const channel = realtimeChannelRef.current as
        | { send: (opts: { type: "broadcast"; event: string; payload: unknown }) => Promise<unknown> }
        | null;
      if (!channel) return;
      void channel.send({ type: "broadcast", event: "typing", payload: userId });
    }, 250);

    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    };
  }, [chatDraft, isSupabaseMode, sessionId, viewerUserId]);

  async function submitChat() {
    const body = chatDraft.trim();
    if (!body) return;

    if (!isSupabaseMode || !sessionId) {
      setMessages((prev) => [
        ...prev,
        { id: `m-${Date.now()}`, author: "You", body, ts: Date.now() },
      ]);
      setChatDraft("");
      return;
    }

    setChatError(null);
    try {
      const res = await fetch("/api/battle-session/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ battleId: sessionId, body }),
      });

      if (!res.ok) {
        setChatError("Unable to send message.");
        return;
      }

      setChatDraft("");
      await reloadMessages();
    } catch {
      setChatError("Unable to send message.");
    }
  }

  async function submitVote(slot: 1 | 2) {
    if (!sessionId) return;
    if (!isSupabaseMode) {
      if (hasVoted) return;
      if (slot === 1) setVoteA((n) => n + 1);
      if (slot === 2) setVoteB((n) => n + 1);
      setHasVoted(true);
      return;
    }

    if (hasVoted) return;
    setVoteError(null);
    try {
      const res = await fetch("/api/battle-session/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ battleId: sessionId, slot }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as unknown;
        const code =
          body && typeof body === "object" && body && "error" in body
            ? String((body as { error?: unknown }).error)
            : null;
        if (code === "voting_closed") {
          setVoteError("Voting is closed.");
          return;
        }
        setVoteError("Unable to submit vote.");
        return;
      }

      await reloadVotes();
    } catch {
      setVoteError("Unable to submit vote.");
    }
  }

  const lastRecordingMetaPostedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;

    async function cleanupRecording(recordingId: string) {
      try {
        await fetch("/api/battle-session/recordings/cleanup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recordingId }),
        });
      } catch {
        // best-effort
      }
    }

    async function uploadRecording() {
      if (!recordingBlob || !sessionId || !isSupabaseMode) return;
      const key = `${recordingBlob.size}:${recordingBlob.type}:${recordingSeconds}:${sessionId}`;
      if (lastRecordingMetaPostedRef.current === key) return;
      lastRecordingMetaPostedRef.current = key;

      setRecordingUploadError(null);
      setIsUploadingRecording(true);

      try {
        const initRes = await fetch("/api/battle-session/recordings/upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            battleId: sessionId,
            mimeType: recordingBlob.type || null,
            durationSeconds: recordingSeconds,
            bytes: recordingBlob.size,
          }),
        });

        const initBody = (await initRes.json()) as
          | {
              ok: true;
              mode: "supabase";
              recordingId: string;
              bucket: string;
              path: string;
              token: string;
              signedUrl: string;
            }
          | { error: string; details?: string };

        if (!initRes.ok || !("ok" in initBody)) {
          setRecordingUploadError("Unable to initialize upload.");
          return;
        }

        let supabase: ReturnType<typeof createSupabaseBrowserClient>;
        try {
          supabase = createSupabaseBrowserClient();
        } catch {
          await cleanupRecording(initBody.recordingId);
          setRecordingUploadError("Supabase is not configured.");
          return;
        }

        const { error: uploadError } = await supabase.storage
          .from(initBody.bucket)
          .uploadToSignedUrl(initBody.path, initBody.token, recordingBlob);

        if (uploadError) {
          await cleanupRecording(initBody.recordingId);
          setRecordingUploadError("Upload failed.");
          return;
        }

        const finalizeRes = await fetch("/api/battle-session/recordings/finalize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recordingId: initBody.recordingId }),
        });

        if (!finalizeRes.ok) {
          await cleanupRecording(initBody.recordingId);
          setRecordingUploadError("Upload failed.");
          return;
        }

        if (cancelled) return;
        setLatestRecordingId(initBody.recordingId);
        await reloadRecordings();
      } catch {
        setRecordingUploadError("Upload failed.");
      } finally {
        setIsUploadingRecording(false);
      }
    }

    void uploadRecording();
    return () => {
      cancelled = true;
    };
  }, [isSupabaseMode, recordingBlob, recordingSeconds, reloadRecordings, sessionId]);

  async function playPersisted(recordingId: string) {
    setPlaybackError(null);
    setIsPlayingPersisted(true);

    try {
      const res = await fetch(
        `/api/battle-session/recordings/download?recordingId=${encodeURIComponent(recordingId)}`,
      );
      const body = (await res.json()) as
        | { ok: true; mode: "supabase"; url: string }
        | { error: string; details?: string };

      if (!res.ok || !("ok" in body) || !body.url) {
        setPlaybackError("Unable to load playback URL.");
        return;
      }

      if (!audioRef.current) {
        setPlaybackError("Audio element not ready.");
        return;
      }

      audioRef.current.src = body.url;
      await audioRef.current.play();
    } catch {
      setPlaybackError("Playback failed.");
    } finally {
      setIsPlayingPersisted(false);
    }
  }

  async function playLatestPersisted() {
    if (!latestRecordingId) return;
    await playPersisted(latestRecordingId);
  }

  async function downloadPersisted(recordingId: string) {
    try {
      const res = await fetch(
        `/api/battle-session/recordings/download?recordingId=${encodeURIComponent(recordingId)}`,
      );
      const body = (await res.json()) as
        | { ok: true; mode: "supabase"; url: string }
        | { error: string; details?: string };
      if (!res.ok || !("ok" in body) || !body.url) {
        setPlaybackError("Unable to load download URL.");
        return;
      }

      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch {
      setPlaybackError("Unable to download recording.");
    }
  }

  async function deletePersistedRecording(recordingId: string) {
    const confirmed = window.confirm("Delete this persisted recording? This cannot be undone.");
    if (!confirmed) return;

    setDeleteError(null);
    setDeletingRecordingId(recordingId);

    lastRecordingsSnapshotRef.current = recordings;
    setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
    try {
      const res = await fetch("/api/battle-session/recordings/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recordingId }),
      });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        if (lastRecordingsSnapshotRef.current) {
          setRecordings(lastRecordingsSnapshotRef.current);
          lastRecordingsSnapshotRef.current = null;
        }
        setDeleteError(
          body && typeof body === "object" && body && "error" in body
            ? `Delete failed: ${(body as { error?: unknown }).error as string}`
            : "Delete failed.",
        );
        return;
      }

      lastRecordingsSnapshotRef.current = null;
      await reloadRecordings();
    } catch {
      if (lastRecordingsSnapshotRef.current) {
        setRecordings(lastRecordingsSnapshotRef.current);
        lastRecordingsSnapshotRef.current = null;
      }
      setDeleteError("Delete failed.");
    } finally {
      setDeletingRecordingId(null);
    }
  }

  const canRecord = recordingState === "idle" || recordingState === "stopped";
  const canStop = recordingState === "recording";
  const canPlayRecording = recordingState === "stopped";
  const canStopPlayback = recordingState === "playing";

  async function enableMic() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicStatus("unsupported");
      setMicError("Mic capture is not supported in this browser.");
      return;
    }
    setMicError(null);
    setMicStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicStatus("granted");
    } catch (err) {
      const name = (err as { name?: string } | null)?.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMicStatus("denied");
        setMicError("Mic permission was denied.");
        return;
      }
      setMicStatus("error");
      setMicError("Unable to access microphone.");
    }
  }

  function startRecording() {
    if (!streamRef.current) {
      setMicError("Enable mic before recording.");
      return;
    }
    setMicError(null);

    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    setRecordingBlob(null);
    chunksRef.current = [];

    const recorder = new MediaRecorder(streamRef.current);
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      setRecordingBlob(blob);
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      setRecordingState("stopped");
    };

    setRecordingSeconds(0);
    setRecordingState("recording");
    recorder.start(250);
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "inactive") return;
    recorder.stop();
  }

  async function playRecording() {
    if (!recordingUrl || !audioRef.current) return;
    setRecordingState("playing");
    audioRef.current.src = recordingUrl;
    try {
      await audioRef.current.play();
    } catch {
      setMicError("Playback failed.");
      setRecordingState("stopped");
    }
  }

  function stopPlayback() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setRecordingState(recordingBlob ? "stopped" : "idle");
  }

  return (
    <div data-testid="battle-room" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Battle Room</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live battle cockpit.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {isSupabaseMode ? (
            <>
              <div>Online: {onlineCount ?? "..."}</div>
              <div>
                Typing: {typingUserIds.length > 0 ? `${typingUserIds.length}` : "--"}
              </div>
            </>
          ) : (
            <div>Realtime: off</div>
          )}
        </div>
      </div>

      <Card className="border-border/60 bg-card/40 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
            <div className="text-xs text-muted-foreground">
              Round <span className="text-foreground">{round}</span>
            </div>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <div className="text-xs text-muted-foreground">
              Latency <span className="text-foreground">{latencyMs ?? "--"}ms</span>
            </div>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <div className="text-xs text-muted-foreground">
              Session{" "}
              <span className="font-mono text-foreground">
                {sessionId ? sessionId.slice(0, 8) : "--------"}
              </span>
            </div>

            <Separator orientation="vertical" className="mx-1 h-4" />
            <div className="text-xs text-muted-foreground">
              Status{" "}
              <span className="text-foreground">{sessionMeta?.status ?? "--"}</span>
            </div>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <div className="text-xs text-muted-foreground">
              A{" "}
              <span className="font-mono text-foreground">{formatParticipantLabel(slotA)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              B{" "}
              <span className="font-mono text-foreground">{formatParticipantLabel(slotB)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground">Countdown</div>
            <div className="rounded-md border border-border/60 bg-background/40 px-3 py-1 font-mono text-sm">
              {formatMMSS(countdownSeconds)}
            </div>

            {sessionMeta?.can_manage ? (
              sessionMeta.status === "complete" || sessionMeta.status === "canceled" ? null : (
                <>
                  {sessionMeta.status !== "live" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateBattleStatus("live")}
                      disabled={isUpdatingStatus}
                    >
                      {isUpdatingStatus ? "Updating..." : "Start"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void finalizeBattle()}
                      disabled={isFinalizing || votingClosed}
                    >
                      {isFinalizing ? "Finalizing..." : "Finalize"}
                    </Button>
                  )}
                </>
              )
            ) : null}

            {showJoinAsB ? (
              <Button size="sm" variant="secondary" onClick={joinAsB} disabled={isJoining}>
                {isJoining ? "Joining..." : "Join as B"}
              </Button>
            ) : null}

            {sessionId ? (
              <Button size="sm" variant="outline" onClick={leaveBattle}>
                Leave battle
              </Button>
            ) : (
              <Button size="sm" onClick={startNewBattle}>
                Start session
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Video Battle UI */}
      {sessionId ? (
        <VideoBattleProduction
          battleId={sessionId}
          viewerUserId={sessionMeta?.viewer_user_id ?? viewerUserIdFallback ?? ""}
          localSlot={localSlot}
          onStreamReady={async (stream) => {
            // Check video session limit before tracking
            const canUseVideo = await checkUsageLimit("video_session");
            if (!canUseVideo) {
              console.warn("Video session limit reached for current plan");
            }
            // Track video session usage
            await trackUsage("video_session", { battleId: sessionId });
            console.log("Local video stream ready:", stream);
          }}
        />
      ) : null}

      {sessionError ? (
        <div className="text-xs text-amber-200/90">{sessionError}</div>
      ) : null}

      {sessionMetaError ? (
        <div className="text-xs text-amber-200/90">{sessionMetaError}</div>
      ) : null}

      {joinError ? <div className="text-xs text-amber-200/90">{joinError}</div> : null}

      {statusError ? <div className="text-xs text-amber-200/90">{statusError}</div> : null}

      {finalizeError ? <div className="text-xs text-amber-200/90">{finalizeError}</div> : null}

      {sessionMeta?.status === "complete" && (sessionMeta.result || finalizeInfo?.result) ? (
        <Card className="border-border/60 bg-card/40 p-4 backdrop-blur">
          <div className="text-sm font-medium">Result</div>
          <div className="mt-2 grid gap-2 text-xs">
            <div>
              Winner:{" "}
              <span className="font-mono text-foreground">
                {winnerSlot === 1 ? "A" : winnerSlot === 2 ? "B" : "Tie"}
              </span>
            </div>
            <div>
              Votes:{" "}
              <span className="font-mono text-foreground">
                A={counts?.["1"] ?? 0} / B={counts?.["2"] ?? 0}
              </span>
            </div>
            {finalizeInfo ? (
              <div className="text-muted-foreground">Battle finalized</div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card
            data-testid="beat-slot"
            className="border-border/60 bg-card/40 p-5 backdrop-blur"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Beat</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {currentBeat
                    ? `${currentBeat.title} · ${currentBeat.tempo} BPM${typeof currentBeat.duration_seconds === "number" ? ` · ${currentBeat.duration_seconds}s` : ""}`
                    : "No beat library available"}
                </div>
              </div>
              <Badge variant="secondary">slot</Badge>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setBeatModalOpen(true)}>
                Choose Beat
              </Button>
              <Button
                onClick={() => setBeatPlaying((p) => !p)}
                disabled={!currentBeat}
              >
                {beatPlaying ? "Pause" : "Play"}
              </Button>
              <div className="ml-auto text-xs text-muted-foreground">
                {currentBeat ? (beatPlaying ? "Playing" : "Idle") : "No beat available"}
              </div>
            </div>
          </Card>

          <Card
            data-testid="recording-slot"
            className="border-border/60 bg-card/40 p-5 backdrop-blur"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Recording</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Status: <span className="text-foreground">{recordingState}</span> · Duration:{" "}
                  <span className="font-mono text-foreground">
                    {formatMMSS(recordingSeconds)}
                  </span>
                  {isSupabaseMode ? (
                    <>
                      {" "}· Persisted{" "}
                      <span className="font-mono text-foreground">
                        {recordingsCount ?? "--"}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <Badge variant="secondary">slot</Badge>
            </div>

            <Separator className="my-4" />

            <div className="grid gap-3">
              <div className="h-14 rounded-lg border border-border/60 bg-background/30">
                <div className="h-full w-full rounded-lg bg-gradient-to-r from-cyan-500/10 via-fuchsia-500/10 to-emerald-500/10" />
              </div>

              <audio
                ref={audioRef}
                className="hidden"
                onEnded={() => setRecordingState(recordingBlob ? "stopped" : "idle")}
              />

              <div className="flex flex-wrap items-center gap-2">
                {isClient && micStatus !== "granted" ? (
                  <Button
                    variant="outline"
                    onClick={enableMic}
                    disabled={micStatus === "requesting" || micStatus === "unsupported"}
                  >
                    {micStatus === "requesting" ? "Requesting..." : "Enable Mic"}
                  </Button>
                ) : isClient && micStatus === "granted" ? (
                  <Badge className="bg-cyan-500/15 text-cyan-200">Mic ready</Badge>
                ) : (
                  <Button variant="outline" disabled>
                    Loading...
                  </Button>
                )}

                <Button
                  onClick={startRecording}
                  disabled={!canRecord || micStatus !== "granted"}
                >
                  Record
                </Button>
                <Button
                  variant="outline"
                  onClick={stopRecording}
                  disabled={!canStop}
                >
                  Stop
                </Button>
                <Button
                  variant="secondary"
                  onClick={playRecording}
                  disabled={!canPlayRecording || !recordingUrl}
                >
                  Play
                </Button>

                {isSupabaseMode ? (
                  <Button
                    variant="outline"
                    onClick={() => void playLatestPersisted()}
                    disabled={!latestRecordingId || isPlayingPersisted}
                  >
                    {isPlayingPersisted ? "Loading..." : "Play Persisted"}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={stopPlayback}
                  disabled={!canStopPlayback}
                >
                  Stop Playback
                </Button>

                <div className="ml-auto text-xs text-muted-foreground">
                  {isClient && (
                    <>
                      {isSupabaseMode && isUploadingRecording
                        ? "Uploading..."
                        : micStatus === "unsupported"
                          ? "Unsupported"
                          : "MediaRecorder"}
                    </>
                  )}
                  {!isClient && "Loading..."}
                </div>
              </div>

              {isClient && micStatus === "denied" ? (
                <div className="text-xs text-amber-200/90">
                  Mic permission denied. Update site permissions and try again.
                </div>
              ) : null}
              {isClient && micError ? (
                <div className="text-xs text-amber-200/90">{micError}</div>
              ) : null}

              {recordingUploadError ? (
                <div className="text-xs text-amber-200/90">{recordingUploadError}</div>
              ) : null}

              {playbackError ? (
                <div className="text-xs text-amber-200/90">{playbackError}</div>
              ) : null}

              {deleteError ? (
                <div className="text-xs text-amber-200/90">{deleteError}</div>
              ) : null}

              {isSupabaseMode ? (
                <div className="rounded-lg border border-border/60 bg-background/25 p-3">
                  <div className="text-xs text-muted-foreground">Persisted recordings</div>
                  <div className="mt-2 grid gap-2">
                    {recordings
                      .filter((r) => r.storage_bucket && r.storage_path && r.uploaded_at)
                      .slice()
                      .reverse()
                      .map((r, idx) => (
                        <div key={r.id} className="flex items-center gap-2">
                          <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                            <span className="font-mono text-foreground">#{idx + 1}</span>
                            {r.created_at ? (
                              <span className="ml-2">{new Date(r.created_at).toLocaleString()}</span>
                            ) : null}

                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              {typeof r.duration_seconds === "number" ? (
                                <span>{formatMMSS(r.duration_seconds)}</span>
                              ) : null}
                              {typeof r.bytes === "number" ? (
                                <span>{(r.bytes / 1024).toFixed(1)} KB</span>
                              ) : null}
                              {r.mime_type ? <span>{r.mime_type}</span> : null}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void playPersisted(r.id)}
                            disabled={isPlayingPersisted || Boolean(deletingRecordingId)}
                          >
                            Play
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void downloadPersisted(r.id)}
                            disabled={Boolean(deletingRecordingId)}
                          >
                            Download
                          </Button>

                          {sessionRole === "admin" || sessionRole === "mod" ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void deletePersistedRecording(r.id)}
                              disabled={deletingRecordingId === r.id || isPlayingPersisted}
                            >
                              {deletingRecordingId === r.id ? "Deleting..." : "Delete"}
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    {recordings.filter((r) => r.storage_bucket && r.storage_path && r.uploaded_at)
                      .length === 0 ? (
                      <div className="text-xs text-muted-foreground">No persisted recordings yet.</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            data-testid="chat-slot"
            className="border-border/60 bg-card/40 p-5 backdrop-blur"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Chat</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {isSupabaseMode ? "Session messages" : "No chat available"}
                </div>
              </div>
              <Badge variant="secondary">slot</Badge>
            </div>

            <Separator className="my-4" />

            <div className="grid gap-3">
              <div className="max-h-56 overflow-auto rounded-lg border border-border/60 bg-background/25 p-3">
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div key={m.id} className="text-sm">
                      <span className="text-xs text-muted-foreground">{m.author}</span>
                      <span className="text-muted-foreground">: </span>
                      <span className="text-foreground">{m.body}</span>
                    </div>
                  ))}
                </div>
              </div>

              {chatError ? <div className="text-xs text-amber-200/90">{chatError}</div> : null}

              <div className="flex items-end gap-2">
                <Textarea
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder="Say something..."
                  className="min-h-[44px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitChat();
                    }
                  }}
                />
                <Button onClick={submitChat} disabled={!chatDraft.trim()}>
                  Send
                </Button>
              </div>
            </div>
          </Card>

          <Card
            data-testid="vote-slot"
            className="border-border/60 bg-card/40 p-5 backdrop-blur"
          >
            {(() => {
              const remainingSeconds = votingRemainingSeconds;

              return (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">Judge / Vote</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {isSupabaseMode ? "Session vote totals" : "Local vote counts (anti-double-vote lock)"}
                      </div>
                      {isSupabaseMode ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Voting {votingClosed ? "closed" : "open"}
                          {remainingSeconds !== null && !votingClosed
                            ? ` · closes in ${remainingSeconds}s`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                    <Badge variant="secondary">live</Badge>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => {
                          void submitVote(1);
                        }}
                        disabled={hasVoted || votingClosed}
                      >
                        Vote A
                        <span className="ml-2 rounded-md border border-border/60 bg-background/40 px-2 py-0.5 text-xs">
                          {voteA}
                        </span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          void submitVote(2);
                        }}
                        disabled={hasVoted || votingClosed}
                      >
                        Vote B
                        <span className="ml-2 rounded-md border border-border/60 bg-background/40 px-2 py-0.5 text-xs">
                          {voteB}
                        </span>
                      </Button>
                    </div>

                    {voteError ? <div className="text-xs text-amber-200/90">{voteError}</div> : null}

                    {votingClosed ? (
                      <div className="text-xs text-muted-foreground">Voting is closed for this round.</div>
                    ) : null}

                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        {hasVoted
                          ? `Vote submitted${myVote ? ` (you voted ${myVote === 1 ? "A" : "B"})` : ""}`
                          : votingClosed
                            ? "Voting is closed"
                            : "You can vote once"}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (isSupabaseMode) return;
                          setHasVoted(false);
                        }}
                        disabled={isSupabaseMode}
                      >
                        Reset (dev)
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </Card>
        </div>
      </div>

      <Dialog open={beatModalOpen} onOpenChange={setBeatModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a beat</DialogTitle>
            <DialogDescription>Select an active beat from the live library.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Input
              value={beatSearch}
              onChange={(e) => setBeatSearch(e.target.value)}
              placeholder="Search title, artist, or genre"
            />
            <div className="max-h-64 overflow-auto rounded-lg border border-border/60 bg-background/30 p-2">
              {beatsLoading ? (
                <div className="p-3 text-sm text-muted-foreground">Loading beats...</div>
              ) : beatLoadError ? (
                <div className="p-3 text-sm text-amber-200/90">{beatLoadError}</div>
              ) : visibleBeats.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No beats match your search.</div>
              ) : (
                <div className="grid gap-2">
                  {visibleBeats.map((beat) => (
                    <button
                      key={beat.id}
                      type="button"
                      className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-left hover:bg-background/60"
                      onClick={() => {
                        setCurrentBeat(beat);
                        setBeatPlaying(false);
                        setBeatModalOpen(false);
                      }}
                    >
                      <div className="text-sm font-medium">{beat.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {beat.artist} · {beat.tempo} BPM · {beat.genre}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBeatModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}




