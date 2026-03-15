import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TournamentRegisterButton } from "@/components/community/TournamentRegisterButton";
import { Trophy, Users, Zap, Calendar, Clock } from "lucide-react";

type Participant = {
  id: string;
  status: string;
  seed: number | null;
  final_placement: number | null;
  registered_at: string;
  user_profiles: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    elo_rating: number;
    tier: string;
  }[] | null;
};

type Tournament = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  format: string;
  max_participants: number;
  entry_fee_tokens: number;
  prize_pool_tokens: number;
  registration_deadline: string | null;
  starts_at: string | null;
  created_at: string;
  bracket_data: unknown | null;
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: "border-slate-500/40 text-slate-400",
  registration: "border-green-500/40 text-green-400",
  live: "border-red-500/40 text-red-400",
  completed: "border-muted-foreground/40 text-muted-foreground",
  cancelled: "border-destructive/40 text-destructive",
};

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  swiss: "Swiss",
};

function formatDate(d: string | null) {
  if (!d) return "TBD";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TIER_COLORS: Record<string, string> = {
  bronze: "text-amber-600",
  silver: "text-slate-400",
  gold: "text-yellow-400",
  platinum: "text-cyan-400",
  diamond: "text-blue-400",
  legend: "text-purple-400",
};

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Database not configured.
      </div>
    );
  }

  // Fetch tournament
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !tournament) notFound();

  // Fetch participants
  const { data: participants } = await supabase
    .from("tournament_participants")
    .select(`
      id,
      status,
      seed,
      final_placement,
      registered_at,
      user_profiles (
        id,
        handle,
        display_name,
        avatar_url,
        elo_rating,
        tier
      )
    `)
    .eq("tournament_id", id)
    .order("seed", { ascending: true, nullsFirst: false });

  const confirmedParticipants = (participants ?? []).filter(
    (p: Participant) => p.status === "confirmed" || p.status === "registered"
  );
  const spotsLeft = (tournament as Tournament).max_participants - confirmedParticipants.length;
  const isOpen = (tournament as Tournament).status === "registration" && spotsLeft > 0;

  // Check if current user is registered
  const user = await getSessionUser();
  const isRegistered = user
    ? (participants ?? []).some(
        (p: Participant) => {
          const profile = Array.isArray(p.user_profiles) ? p.user_profiles[0] : null;
          return profile?.id === user.id;
        }
      )
    : false;

  const t = tournament as Tournament;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/app/tournaments" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Tournaments
            </Link>
          </div>
          <h1 className="text-2xl font-bold">{t.name}</h1>
          {t.description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{t.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className={STATUS_COLORS[t.status] ?? ""}>
              {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {FORMAT_LABELS[t.format] ?? t.format}
            </Badge>
          </div>
        </div>

        {/* Register / Status */}
        <div className="shrink-0">
          {user && (
            <TournamentRegisterButton
              tournamentId={t.id}
              entryFee={t.entry_fee_tokens}
              isRegistered={isRegistered}
              isOpen={isOpen}
              status={t.status}
            />
          )}
          {!user && isOpen && (
            <Button asChild size="sm">
              <Link href="/login?next=/app/tournaments">Sign in to Register</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            icon: <Users className="h-4 w-4 text-muted-foreground" />,
            label: "Participants",
            value: `${confirmedParticipants.length} / ${t.max_participants}`,
          },
          {
            icon: <Zap className="h-4 w-4 text-yellow-400" />,
            label: "Entry Fee",
            value: t.entry_fee_tokens === 0 ? "Free" : `${t.entry_fee_tokens} tokens`,
          },
          {
            icon: <Trophy className="h-4 w-4 text-yellow-400" />,
            label: "Prize Pool",
            value: `${t.prize_pool_tokens} tokens`,
          },
          {
            icon: <Calendar className="h-4 w-4 text-muted-foreground" />,
            label: "Starts",
            value: formatDate(t.starts_at),
          },
        ].map((s) => (
          <Card key={s.label} className="border-border/60 bg-card/30 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              {s.icon}
              {s.label}
            </div>
            <div className="text-lg font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Registration deadline warning */}
      {t.registration_deadline && t.status === "registration" && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-2 text-sm">
          <Clock className="h-4 w-4 text-yellow-400 shrink-0" />
          <span className="text-yellow-300/80">
            Registration closes {formatDate(t.registration_deadline)}
          </span>
          {spotsLeft <= 5 && spotsLeft > 0 && (
            <Badge variant="outline" className="ml-auto border-red-500/40 text-red-400 text-[10px]">
              {spotsLeft} spots left
            </Badge>
          )}
          {spotsLeft === 0 && (
            <Badge variant="outline" className="ml-auto border-muted-foreground/40 text-muted-foreground text-[10px]">
              Full
            </Badge>
          )}
        </div>
      )}

      <Separator className="border-border/40" />

      {/* Participants */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Participants ({confirmedParticipants.length})
        </h2>

        {confirmedParticipants.length === 0 ? (
          <Card className="border-border/60 bg-card/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t.status === "registration"
                ? "No registrations yet. Be the first to enter."
                : "No participants recorded."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {confirmedParticipants.map((p: Participant, idx: number) => {
              const profile = Array.isArray(p.user_profiles) ? p.user_profiles[0] : null;
              if (!profile) return null;
              return (
                <Link
                  key={p.id}
                  href={`/app/players/${profile.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/30 p-3 transition-colors hover:bg-card/60"
                >
                  {/* Rank / seed */}
                  <div className="w-6 shrink-0 text-center text-sm font-bold text-muted-foreground">
                    {p.final_placement
                      ? p.final_placement === 1 ? "🥇" : p.final_placement === 2 ? "🥈" : p.final_placement === 3 ? "🥉" : `#${p.final_placement}`
                      : p.seed ? `#${p.seed}` : `${idx + 1}`}
                  </div>

                  {/* Avatar */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
                    {profile.avatar_url ? (
                       
                      <span className="sr-only">{profile.handle}</span>
                    ) : (
                      (profile.display_name ?? profile.handle)[0]
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {profile.display_name ?? profile.handle}
                    </div>
                    <div className={`text-xs font-medium ${TIER_COLORS[profile.tier] ?? "text-muted-foreground"}`}>
                      {profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1)} · {profile.elo_rating} ELO
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
