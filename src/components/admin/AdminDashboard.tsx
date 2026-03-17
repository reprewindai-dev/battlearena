"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Users, Swords, Trophy, Shield, Activity, Zap,
  Search, ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Stats = {
  total_users: number;
  total_battles: number;
  live_battles: number;
  total_tournaments: number;
  open_mod_cases: number;
  activity_24h: number;
};

type UserRow = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  elo_rating: number;
  tier: string;
  token_balance: number;
  created_at: string;
};

const ROLE_OPTIONS = ["all", "user", "mod", "admin", "banned"] as const;
const ROLE_COLORS: Record<string, string> = {
  admin: "border-red-500/40 text-red-400",
  mod: "border-purple-500/40 text-purple-400",
  banned: "border-muted-foreground/40 text-muted-foreground line-through",
  user: "border-border/40 text-muted-foreground",
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}) {
  return (
    <Card className="border-border/60 bg-card/30 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-2xl font-black tabular-nums ${color}`}>{value}</div>
          <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
          {sub && <div className="mt-0.5 text-[10px] text-muted-foreground/60">{sub}</div>}
        </div>
        <div className={`mt-0.5 ${color}`}>{icon}</div>
      </div>
    </Card>
  );
}

// ─── User Table Row ──────────────────────────────────────────────────────────

function UserTableRow({
  user,
  onUpdate,
}: {
  user: UserRow;
  onUpdate: (id: string, updates: { role?: string; token_balance?: number }) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [role, setRole] = React.useState(user.role);
  const [tokens, setTokens] = React.useState(String(user.token_balance));
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    await onUpdate(user.id, {
      role,
      token_balance: parseInt(tokens, 10),
    });
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/20 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium truncate">{user.display_name ?? user.handle}</span>
          <span className="font-mono text-xs text-muted-foreground">@{user.handle}</span>
          <Badge variant="outline" className={`text-[10px] ${ROLE_COLORS[user.role] ?? ROLE_COLORS.user}`}>
            {user.role}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>ELO {user.elo_rating}</span>
          <span>{user.tier}</span>
          <span>💎 {user.token_balance} tokens</span>
          <span className="font-mono opacity-60">{user.id.slice(0, 8)}…</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {editing ? (
          <>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["user", "mod", "admin", "banned"].map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="h-7 w-24 text-xs"
              value={tokens}
              onChange={e => setTokens(e.target.value)}
              placeholder="Tokens"
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? "…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(1);
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(true);
  const [statsLoading, setStatsLoading] = React.useState(true);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  async function loadStats() {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      toast.error("Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        ...(roleFilter !== "all" ? { role: roleFilter } : {}),
      });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadStats(); }, []);
  React.useEffect(() => { loadUsers(); }, [page, debouncedSearch, roleFilter]);

  async function handleUserUpdate(id: string, updates: { role?: string; token_balance?: number }) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Update failed"); return; }
      toast.success("User updated");
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...json.user } : u));
    } catch {
      toast.error("Network error");
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/30" />
          ))
        ) : stats ? (
          <>
            <StatCard label="Total Users" value={stats.total_users} icon={<Users className="h-4 w-4" />} color="text-blue-400" />
            <StatCard label="Total Battles" value={stats.total_battles} icon={<Swords className="h-4 w-4" />} color="text-orange-400" />
            <StatCard label="Live Now" value={stats.live_battles} icon={<Zap className="h-4 w-4" />} color="text-green-400" sub="active battles" />
            <StatCard label="Tournaments" value={stats.total_tournaments} icon={<Trophy className="h-4 w-4" />} color="text-yellow-400" />
            <StatCard label="Open Cases" value={stats.open_mod_cases} icon={<Shield className="h-4 w-4" />} color={stats.open_mod_cases > 0 ? "text-red-400" : "text-muted-foreground"} />
            <StatCard label="Activity 24h" value={stats.activity_24h} icon={<Activity className="h-4 w-4" />} color="text-purple-400" />
          </>
        ) : null}
      </div>

      <Separator />

      {/* User management */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">User Management</h2>
            <p className="text-xs text-muted-foreground">{total} total users</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { loadStats(); loadUsers(); }}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search handle or name…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map(r => (
                <SelectItem key={r} value={r}>{r === "all" ? "All roles" : r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* User list */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/30" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <Card className="border-border/60 bg-card/30 p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">No users found.</p>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {users.map(u => (
              <UserTableRow key={u.id} user={u} onUpdate={handleUserUpdate} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {pages} · {total} users
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="h-7 gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pages - 1}
                onClick={() => setPage(p => p + 1)}
                className="h-7 gap-1 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
