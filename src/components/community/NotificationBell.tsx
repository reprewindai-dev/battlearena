"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Bell, Trophy, Swords, Users, Star, Zap, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  actor: { id: string; handle: string; display_name: string | null; avatar_url: string | null } | null;
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  battle_result: <Trophy className="h-3.5 w-3.5 text-yellow-400" />,
  battle_invite: <Swords className="h-3.5 w-3.5 text-blue-400" />,
  follow: <Users className="h-3.5 w-3.5 text-green-400" />,
  vote_result: <Star className="h-3.5 w-3.5 text-purple-400" />,
  challenge: <Zap className="h-3.5 w-3.5 text-orange-400" />,
  achievement: <Star className="h-3.5 w-3.5 text-yellow-400" />,
  tournament_start: <Trophy className="h-3.5 w-3.5 text-cyan-400" />,
  system: <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />,
  moderation: <AlertCircle className="h-3.5 w-3.5 text-red-400" />,
};

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const fetchNotifications = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=15");
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.notifications ?? []);
      setUnreadCount(json.unread_count ?? 0);
    } catch {}
    setLoading(false);
  }, []);

  // Poll every 30 seconds for unread count
  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border/60 bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <div className="text-sm font-semibold">Notifications</div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={markAllRead}>
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              notifications.map(n => {
                const isUnread = !n.read_at;
                const content = (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/20 ${isUnread ? "bg-muted/10" : ""}`}
                    onClick={() => isUnread && markRead(n.id)}
                  >
                    <div className="mt-0.5 shrink-0 rounded-full border border-border/60 bg-background/40 p-1.5">
                      {TYPE_ICONS[n.type] ?? <Bell className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${isUnread ? "font-medium" : ""}`}>{n.title}</p>
                        {isUnread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
                      </div>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[10px] text-muted-foreground/60">{formatDistanceToNow(n.created_at)}</p>
                    </div>
                  </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : content;
              })
            )}
          </div>

          <div className="border-t border-border/40 p-2">
            <Button asChild variant="ghost" size="sm" className="w-full text-xs" onClick={() => setOpen(false)}>
              <Link href="/app/notifications">View all notifications</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
