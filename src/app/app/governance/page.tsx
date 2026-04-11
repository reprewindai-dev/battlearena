import { GovernanceProposals } from "@/components/governance/GovernanceProposals";

export const metadata = { title: "Governance - Spitzone" };

export default function GovernancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community Governance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vote on proposals that shape the platform. Every registered member has a voice.
        </p>
      </div>
      <GovernanceProposals />
    </div>
  );
}
