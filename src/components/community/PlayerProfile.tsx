"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, Swords, Trophy, Star, Zap, Users } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "@/lib/utils";
import { ChallengeModal } from "@/components/community/ChallengeModal";

type Achievement = {
  id: string;
  achievement_id: string;
  label: string;
  description: string | null;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  earned_at: string;
};

type ProfileData = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  elo_rating: number;
  wins: number;
  losses: number;
  total_battles: number;
  win_rate: number;
  tier: string;
  is_verified: boolean;
  token_balance: number;
  total_earnings: number;
  follower_count: number;
  following_count: number;
  achievement_count: number;
  created_at: string;
};

const TIER_COLORS: Record<string, string> = {
  bronze: "from-amber-800 to-amber-600",
  silver: "from-slate-500 to-slate-300",
  gold: "from-yellow-600 to-yellow-400",
  platinum: "from-cyan-600 to-cyan-400",
  diamond: "from-blue-600 to-blue-400",
  legend: "from-purple-600 to-pink-500",
};

const RARITY_COLORS: Record<string, string> = {
  common: "border-border/60 bg-card/40",
  rare: "border-blue-500/40 bg-blue-500/10",
  epic: "border-purple-500/40 bg-purple-500/10",
  legendary: "border-yellow-500/40 bg-yellow-500/10",
};

function AchievementCard({ achievement }: { achievement: Achievement }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${RARITY_COLORS[achievement.rarity]}`}>
      <span className="text-2xl">{achievement.icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-medium">{achievement.label}</div>
        {achievement.description && (
          <div className="text-xs text-muted-foreground">{achievement.description}</div>
        )}
        <div className="mt-0.5 text-[10px] text-muted-foreground/60">
          {formatDistanceToNow(achievement.earned_at)}
        </div>
      </div>
      <Badge
        variant="outline"
        className={`ml-auto shrink-0 text-[10px] uppercase ${
          achievement.rarity === "legendary" ? "border-yellow-500/50 text-yellow-400" :
          achievement.rarity === "epic" ? "border-purple-500/50 text-purple-400" :
          achievement.rarity === "rare" ? "border-blue-500/50 text-blue-400" :
          "text-muted-foreground"
        }`}
      >
        {achievement.rarity}
      </Badge>
    </div>
  );
}

export function PlayerProfile({
  userId,
  isOwnProfile = false,
}: {
  userId: string;
  isOwnProfile?: boolean;
}) {
  const [profile, setProfile] = React.useState<ProfileData | null>(null);
  const [achievements, setAchievements] = React.useState<Achievement[]>([]);
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [followLoading, setFollowLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState({ handle: "", display_name: "", bio: "" });
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const [challengeOpen, setChallengeOpen] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/users/${userId}/profile`).then(r => r.json()),
      !isOwnProfile ? fetch(`/api/users/${userId}/follow`).then(r => r.json()) : Promise.resolve(null),
    ])
      .then(([profileData, followData]) => {
        setProfile(profileData.profile ?? null);
        setAchievements(profileData.achievements ?? []);
        if (followData) setIsFollowing(followData.is_following ?? false);
        if (profileData.profile) {
          setEditForm({
            handle: profileData.profile.handle ?? "",
            display_name: profileData.profile.display_name ?? "",
            bio: profileData.profile.bio ?? "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, isOwnProfile]);

  async function handleFollow() {
    setFollowLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      await fetch(`/api/users/${userId}/follow`, { method });
      setIsFollowing(!isFollowing);
      setProfile(prev => prev ? {
        ...prev,
        follower_count: isFollowing ? prev.follower_count - 1 : prev.follower_count + 1
      } : prev);
    } catch {}
    setFollowLoading(false);
  }

  async function handleSave() {
    setSaveLoading(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/profile/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error ?? "Save failed");
        return;
      }
      setProfile(prev => prev ? { ...prev, ...json.profile } : prev);
      setEditing(false);
    } catch {
      setSaveError("Network error");
    } finally {
      setSaveLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-muted/30" />
        <div className="h-48 animate-pulse rounded-xl bg-muted/30" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card className="border-border/60 bg-card/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">Player not found.</p>
      </Card>
    );
  }

  const tierGradient = TIER_COLORS[profile.tier] ?? TIER_COLORS.bronze;

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <Card className="overflow-hidden border-border/60 bg-card/30">
        <div className={`h-2 w-full bg-gradient-to-r ${tierGradient}`} />
        <div className="p-6">
          <div className="flex flex-wrap items-start gap-4">
            {/* Avatar */}
            <Avatar className={`h-16 w-16 bg-gradient-to-br ${tierGradient} text-2xl font-bold text-white`}>
              <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.handle} />
              <AvatarFallback className={`bg-gradient-to-br ${tierGradient} text-white text-2xl font-bold`}>
                {(profile.display_name ?? profile.handle)[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded border border-border/60 bg-background/50 px-3 py-1.5 text-sm"
                    placeholder="Display name"
                    value={editForm.display_name}
                    onChange={e => setEditForm(p => ({ ...p, display_name: e.target.value }))}
                  />
                  <input
                    className="w-full rounded border border-border/60 bg-background/50 px-3 py-1.5 font-mono text-sm"
                    placeholder="handle (alphanumeric + _)"
                    value={editForm.handle}
                    onChange={e => setEditForm(p => ({ ...p, handle: e.target.value.toLowerCase() }))}
                  />
                  <textarea
                    className="w-full rounded border border-border/60 bg-background/50 px-3 py-1.5 text-sm"
                    placeholder="Bio"
                    rows={2}
                    value={editForm.bio}
                    onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))}
                  />
                  {saveError && <p className="text-xs text-destructive">{saveError}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={saveLoading}>
                      {saveLoading ? "Saving…" : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold">{profile.display_name ?? profile.handle}</h1>
                    {profile.is_verified && <span className="text-blue-400" title="Verified">✓</span>}
                    <Badge variant="outline" className={`text-xs uppercase ${
                      profile.tier === "legend" ? "border-purple-500/50 text-purple-400" :
                      profile.tier === "diamond" ? "border-blue-500/50 text-blue-400" :
                      profile.tier === "platinum" ? "border-cyan-500/50 text-cyan-400" :
                      profile.tier === "gold" ? "border-yellow-500/50 text-yellow-400" :
                      "text-muted-foreground"
                    }`}>
                      {profile.tier}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">@{profile.handle}</p>
                  {profile.bio && <p className="mt-1 text-sm">{profile.bio}</p>}
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex shrink-0 gap-2">
              {isOwnProfile ? (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit Profile</Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={handleFollow} disabled={followLoading}>
                    {followLoading ? "…" : isFollowing ? "Unfollow" : "Follow"}
                  </Button>
                  <Button size="sm" onClick={() => setChallengeOpen(true)}>
                    Challenge
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <Separator className="my-4" />
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {[
              { label: "ELO", value: profile.elo_rating, icon: <TrendingUp className="h-3.5 w-3.5" /> },
              { label: "Wins", value: profile.wins, icon: <Trophy className="h-3.5 w-3.5 text-yellow-400" /> },
              { label: "Losses", value: profile.losses, icon: <Swords className="h-3.5 w-3.5 text-red-400" /> },
              { label: "WR%", value: `${profile.win_rate}%`, icon: <Star className="h-3.5 w-3.5 text-green-400" /> },
              { label: "Followers", value: profile.follower_count, icon: <Users className="h-3.5 w-3.5" /> },
              { label: "Following", value: profile.following_count, icon: <Users className="h-3.5 w-3.5 text-muted-foreground" /> },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  {s.icon} {s.label}
                </div>
                <div className="mt-1 text-lg font-bold">{s.value}</div>
              </div>
            ))}
          </div>

          {isOwnProfile && (
            <div className="mt-3 flex items-center gap-4 rounded-lg border border-border/40 bg-muted/10 px-4 py-2">
              <div className="flex items-center gap-1.5 text-sm">
                <Zap className="h-4 w-4 text-yellow-400" />
                <span className="font-medium">{profile.token_balance}</span>
                <span className="text-muted-foreground">tokens</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <div className="text-sm text-muted-foreground">
                ${profile.total_earnings.toFixed(2)} earned
              </div>
              <Button asChild size="sm" variant="outline" className="ml-auto">
                <Link href="/app/shop">Get Tokens</Link>
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs: Achievements */}
      <Tabs defaultValue="achievements">
        <TabsList>
          <TabsTrigger value="achievements">
            Achievements ({achievements.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="achievements" className="mt-4">
          {achievements.length === 0 ? (
            <Card className="border-border/60 bg-card/30 p-6 text-center">
              <p className="text-sm text-muted-foreground">No achievements yet. Keep battling!</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {achievements.map(a => (
                <AchievementCard key={a.id} achievement={a} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Challenge Modal */}
      {!isOwnProfile && profile && (
        <ChallengeModal
          open={challengeOpen}
          onClose={() => setChallengeOpen(false)}
          target={{
            id: userId,
            handle: profile.handle,
            display_name: profile.display_name,
            elo_rating: profile.elo_rating,
            tier: profile.tier,
          }}
        />
      )}
    </div>
  );
}
