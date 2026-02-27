import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/auth/session";
import { ModerationConsole } from "@/components/admin/ModerationConsole";
import { Shield } from "lucide-react";

export default async function ModerationConsolePage() {
  const role = await getSessionRole();
  if (role !== "mod" && role !== "admin") redirect("/app");

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Moderation Console</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and action all reported content. Cases are pulled live from the database.
        </p>
      </div>

      <ModerationConsole />
    </div>
  );
}
