import { TournamentList } from "@/components/community/TournamentList";

export const metadata = { title: "Tournaments - Battle Arena" };

export default function TournamentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tournaments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register, compete, and win. Tournament prize pools paid in tokens.
        </p>
      </div>

      <TournamentList />
    </div>
  );
}

