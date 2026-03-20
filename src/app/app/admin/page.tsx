import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminMaintenancePanel } from "@/components/admin/AdminMaintenancePanel";
import { Separator } from "@/components/ui/separator";
import { getSessionRole } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Admin Panel - Battle Arena" };

export default async function AdminPanelPage() {
  const role = await getSessionRole();
  if (role !== "admin") redirect("/app");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform overview, user management, and maintenance tools.
        </p>
      </div>

      <AdminDashboard />

      <Separator />

      <div>
        <h2 className="mb-3 text-base font-semibold">Maintenance</h2>
        <AdminMaintenancePanel />
      </div>
    </div>
  );
}




