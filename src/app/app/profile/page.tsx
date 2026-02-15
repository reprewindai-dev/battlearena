import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";

export default async function ProfilePage() {
  const user = await getSessionUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Placeholder profile page with server session read.
        </p>
      </div>

      <Card className="border-border/60 bg-card/40 p-5 backdrop-blur">
        <div className="text-sm font-medium">Session</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {user ? (
            <div>
              <div>User ID: {user.id}</div>
              <div>Email: {user.email ?? "(none)"}</div>
            </div>
          ) : (
            <div>Not logged in.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
