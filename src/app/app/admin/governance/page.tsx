import { redirect } from "next/navigation";

import { GovernanceDashboard } from "@/components/admin/GovernanceDashboard";
import { getSessionRole } from "@/lib/auth/session";

export const metadata = { title: "Governance - Battle Arena" };

export default async function GovernancePage() {
  const role = await getSessionRole();
  if (role !== "admin") {
    redirect("/app");
  }

  return <GovernanceDashboard />;
}
