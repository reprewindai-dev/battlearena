import { WalletCard } from "@/components/payment/WalletCard";

export const metadata = { title: "Wallet & Economy - Spitzone" };

export default function EconomyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Crowns (reputation) and Tokens (purchasable currency) balance and transaction history.
        </p>
      </div>
      <WalletCard />
    </div>
  );
}
