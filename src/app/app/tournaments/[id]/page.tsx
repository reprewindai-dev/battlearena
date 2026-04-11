import { notFound } from "next/navigation";
import Link from "next/link";

import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TournamentRegisterButton } from "@/components/community/TournamentRegisterButton";
import { TournamentBracket } from "@/components/tournaments/TournamentBracket";
import { Calendar, Clock, Trophy, Users, Zap } from "lucide-react";

type Tournament = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  format: string;
  max_participants: number;
  entry_fee_tokens: number;
  prize_pool_tokens: number;
  registration_closes: string | null;
  starts_at: string | null;
  created_at: string;
};

type Participant = {
  id: string;
  status: string;
  seed_number: number | null;
  registered_at: string;
  profile: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    elo_rating: number;
    tier: string;
  };
};
type UserRow = { id: string; username: string | null };
type UserProfileRow = { user_id: string; display_name: string | null; avatar_url: string | null; tier: string | null };
type UserRatingRow = { user_id: string; rating: number | null; tier: string | null };
type ParticipantRow = {
  id: string;
  status: string;
  seed_number: number | null;
  registered_at: string;
  user_id: string;
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

const TIER_COLORS: Record<string, string> = {
  bronze: "text-amber-600",
  silver: "text-slate-400",
  gold: "text-yellow-400",
  platinum: "text-cyan-400",
  diamond: "text-blue-400",
  legend: "text-purple-400",
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

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [, sessionRole] = await Promise.all([getSessionUser(), getSessionRole()]);
  const isAdmin = sessionRole === "admin";
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Database not configured.</div>;
  }

  const { data: tournamentRow, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id,name,description,status,format,max_participants,entry_fee_tokens,prize_pool_tokens,registration_closes,starts_at,created_at")
    .eq("id", id)
    .maybeSingle();

  if (tournamentError || !tournamentRow) {
    notFound();
  }

  const tournament = tournamentRow as Tournament;

  const { data: participantRows } = await supabase
    .from("tournament_participants")
    .select("id,status,seed_number,registered_at,user_id")
    .eq("tournament_id", id)
    .order("seed_number", { ascending: true, nullsFirst: false });

  const typedParticipantRows = (participantRows ?? []) as ParticipantRow[];
  const userIds = Array.from(new Set(typedParticipantRows.map((row) => row.user_id)));
  const [{ data: users }, { data: profiles }, { data: ratings }] = await Promise.all([
    userIds.length
      ? supabase.from("users").select("id,username").in("id", userIds)
      : Promise.resolve({ data: [] as UserRow[] }),
    userIds.length
      ? supabase.from("user_profiles").select("user_id,display_name,avatar_url,tier").in("user_id", userIds)
      : Promise.resolve({ data: [] as UserProfileRow[] }),
    userIds.length
      ? supabase.from("user_ratings").select("user_id,rating,tier").in("user_id", userIds)
      : Promise.resolve({ data: [] as UserRatingRow[] }),
  ]);

  const usersById = new Map<string, UserRow>(((users ?? []) as UserRow[]).map((u) => [u.id, u]));
  const profilesById = new Map<string, UserProfileRow>(((profiles ?? []) as UserProfileRow[]).map((p) => [p.user_id, p]));
  const ratingsById = new Map<string, UserRatingRow>(((ratings ?? []) as UserRatingRow[]).map((r) => [r.user_id, r]));

  const participants: Participant[] = typedParticipantRows.map((row) => {
    const user = usersById.get(row.user_id);
    const profile = profilesById.get(row.user_id);
    const rating = ratingsById.get(row.user_id);
    return {
      id: row.id,
      status: row.status,
      seed_number: row.seed_number,
      registered_at: row.registered_at,
      profile: {
        id: row.user_id,
        handle: user?.username ?? row.user_id.slice(0, 8),
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        elo_rating: rating?.rating ?? 1000,
        tier: rating?.tier ?? profile?.tier ?? "bronze",
      },
    };
  });

  const confirmedParticipants = participants.filter(
    (p) => p.status === "confirmed" || p.status === "registered",
  );
  const spotsLeft = tournament.max_participants - confirmedParticipants.length;
  const isOpen = tournament.status === "registration" && spotsLeft > 0;

  const viewer = await getSessionUser();
  const isRegistered = viewer ? participants.some((p) => p.profile.id === viewer.id) : false;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/app/tournaments" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              {"<-"} Tournaments
            </Link>
          </div>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          {tournament.description ? (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{tournament.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className={STATUS_COLORS[tournament.status] ?? ""}>
              {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {FORMAT_LABELS[tournament.format] ?? tournament.format}
            </Badge>
          </div>
        </div>

        <div className="shrink-0">
          {viewer ? (
            <TournamentRegisterButton
              tournamentId={tournament.id}
              entryFee={tournament.entry_fee_tokens}
              isRegistered={isRegistered}
              isOpen={isOpen}
              status={tournament.status}
            />
          ) : isOpen ? (
            <Button asChild size="sm">
              <Link href="/login?next=/app/tournaments">Sign in to Register</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            icon: <Users className="h-4 w-4 text-muted-foreground" />,
            label: "Participants",
            value: `${confirmedParticipants.length} / ${tournament.max_participants}`,
          },
          {
            icon: <Zap className="h-4 w-4 text-yellow-400" />,
            label: "Entry Fee",
            value: tournament.entry_fee_tokens === 0 ? "Free" : `${tournament.entry_fee_tokens} tokens`,
          },
          {
            icon: <Trophy className="h-4 w-4 text-yellow-400" />,
            label: "Prize Pool",
            value: `${tournament.prize_pool_tokens} tokens`,
          },
          {
            icon: <Calendar className="h-4 w-4 text-muted-foreground" />,
            label: "Starts",
            value: formatDate(tournament.starts_at),
          },
        ].map((s: any) => (
          <Card key={s.label} className="border-border/60 bg-card/30 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              {s.icon}
              {s.label}
            </div>
            <div className="text-lg font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

      {tournament.registration_closes && tournament.status === "registration" ? (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-2 text-sm">
          <Clock className="h-4 w-4 text-yellow-400 shrink-0" />
          <span className="text-yellow-300/80">Registration closes {formatDate(tournament.registration_closes)}</span>
          {spotsLeft <= 5 && spotsLeft > 0 ? (
            <Badge variant="outline" className="ml-auto border-red-500/40 text-red-400 text-[10px]">{spotsLeft} spots left</Badge>
          ) : null}
          {spotsLeft === 0 ? (
            <Badge variant="outline" className="ml-auto border-muted-foreground/40 text-muted-foreground text-[10px]">Full</Badge>
          ) : null}
        </div>
      ) : null}

      <Separator className="border-border/40" />

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Participants ({confirmedParticipants.length})
        </h2>

        {confirmedParticipants.length === 0 ? (
          <Card className="border-border/60 bg-card/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {tournament.status === "registration"
                ? "No registrations yet. Be the first to enter."
                : "No participants recorded."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {confirmedParticipants.map((p, idx) => (
              <Link
                key={p.id}
                href={`/app/players/${p.profile.id}`}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/30 p-3 transition-colors hover:bg-card/60"
              >
                <div className="w-6 shrink-0 text-center text-sm font-bold text-muted-foreground">
                  {p.seed_number ? `#${p.seed_number}` : `${idx + 1}`}
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
                  {(p.profile.display_name ?? p.profile.handle)[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.profile.display_name ?? p.profile.handle}</div>
                  <div className={`text-xs font-medium ${TIER_COLORS[p.profile.tier] ?? "text-muted-foreground"}`}>
                    {p.profile.tier.charAt(0).toUpperCase() + p.profile.tier.slice(1)} - {p.profile.elo_rating} ELO
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {(tournament.status === "live" || tournament.status === "completed") && (
        <>
          <Separator className="border-border/40" />
          <TournamentBracket tournamentId={id} isAdmin={isAdmin} />
        </>
      )}

      {isAdmin && ["registration", "upcoming"].includes(tournament.status) && (
        <>
          <Separator className="border-border/40" />
          <TournamentBracket tournamentId={id} isAdmin={true} />
        </>
      )}
    </div>
  );
}

