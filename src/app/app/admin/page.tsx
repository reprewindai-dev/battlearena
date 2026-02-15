import { AdminMaintenancePanel } from "@/components/admin/AdminMaintenancePanel";
import { AdminAuditLogPanel } from "@/components/admin/AdminAuditLogPanel";
import { getSessionRole } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AdminPanelPage() {
  const role = await getSessionRole();
  if (role !== "admin") redirect("/app");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin-only route (RBAC-gated by middleware).
        </p>
      </div>

      <AdminMaintenancePanel />

      <AdminAuditLogPanel />
    </div>
  );
}
