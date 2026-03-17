"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  actor: { id: string; handle: string; display_name: string | null } | null;
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  battle_result: <Trophy className="h-4 w-4 text-yellow-400" />,
  battle_invite: <Swords className="h-4 w-4 text-blue-400" />,
  follow: <Users className="h-4 w-4 text-green-400" />,
  vote_result: <Star className="h-4 w-4 text-purple-400" />,
  challenge: <Zap className="h-4 w-4 text-orange-400" />,
  achievement: <Star className="h-4 w-4 text-yellow-400" />,
  tournament_start: <Trophy className="h-4 w-4 text-cyan-400" />,
  system: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
  moderation: <AlertCircle className="h-4 w-4 text-red-400" />,
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [unreadCount, setUnreadCount] = React.useState(0);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50");
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.notifications ?? []);
      setUnreadCount(json.unread_count ?? 0);
    } catch {}
    setLoading(false);
  }

  React.useEffect(() => { fetchNotifications(); }, []);

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
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/30" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="border-border/60 bg-card/30 p-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">No notifications yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const isUnread = !n.read_at;
            const inner = (
              <div
                className={`flex items-start gap-4 rounded-lg border px-5 py-4 transition-colors ${
                  isUnread
                    ? "border-border/60 bg-card/40 hover:bg-card/60"
                    : "border-border/30 bg-card/20 hover:bg-card/30"
                }`}
                onClick={() => isUnread && markRead(n.id)}
              >
                <div className={`mt-0.5 shrink-0 rounded-full border border-border/60 p-2 ${isUnread ? "bg-background/60" : "bg-muted/20"}`}>
                  {TYPE_ICONS[n.type] ?? <Bell className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-sm leading-snug ${isUnread ? "font-semibold" : ""}`}>{n.title}</p>
                    {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  </div>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground/60">
                    <span>{formatDistanceToNow(n.created_at)}</span>
                    {n.actor && (
                      <>
                        <span>·</span>
                        <Link href={`/app/players/${n.actor.id}`} className="hover:underline" onClick={e => e.stopPropagation()}>
                          @{n.actor.handle}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );

            return n.link ? (
              <Link key={n.id} href={n.link}>{inner}</Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
