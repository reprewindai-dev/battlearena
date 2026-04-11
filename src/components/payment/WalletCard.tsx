"use client";

import * as React from "react";
import { Crown, Coins, ArrowUpRight, ArrowDownLeft, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type WalletBalance = {
  token_balance: number;
  crown_balance: number;
  lifetime_tokens_earned: number;
  lifetime_crowns_earned: number;
};

type Transaction = {
  id: string;
  currency: string;
  amount: number;
  balance_after: number;
  type: string;
  description: string | null;
  reference_type: string | null;
  created_at: string;
};

function formatType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function WalletCard() {
  const [wallet, setWallet] = React.useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currency, setCurrency] = React.useState<"all" | "tokens" | "crowns">("all");

  React.useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "20" });
    if (currency !== "all") params.set("currency", currency);

    Promise.all([
      fetch("/api/economy/wallet").then((r) => r.json()),
      fetch(`/api/economy/transactions?${params}`).then((r) => r.json()),
    ])
      .then(([walletData, txData]) => {
        const wd = walletData as { wallet?: WalletBalance };
        const td = txData as { transactions?: Transaction[] };
        setWallet(wd.wallet ?? null);
        setTransactions(td.transactions ?? []);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [currency]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Crown className="h-4 w-4 text-yellow-400" />
              Crowns
              <Badge variant="outline" className="ml-auto text-[10px] border-yellow-500/30 text-yellow-400">Reputation</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-400">{(wallet?.crown_balance ?? 0).toLocaleString()}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {(wallet?.lifetime_crowns_earned ?? 0).toLocaleString()} earned lifetime
            </div>
            <p className="mt-2 text-xs text-muted-foreground/70">Earned through battle wins and tournaments. Represents your reputation.</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Coins className="h-4 w-4 text-primary" />
              Tokens
              <Badge variant="outline" className="ml-auto text-[10px] border-primary/30 text-primary">Purchasable</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{(wallet?.token_balance ?? 0).toLocaleString()}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {(wallet?.lifetime_tokens_earned ?? 0).toLocaleString()} earned lifetime
            </div>
            <Button asChild size="sm" className="mt-3 w-full" variant="outline">
              <Link href="/app/shop">Buy more tokens</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Transaction history */}
      <Card className="border-border/60 bg-card/30">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Transaction History</CardTitle>
          <div className="flex gap-1">
            {(["all", "tokens", "crowns"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`rounded px-2 py-1 text-[11px] font-medium capitalize transition-colors ${
                  currency === c
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</div>
          ) : (
            <div className="divide-y divide-border/40">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tx.amount > 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    {tx.amount > 0
                      ? <ArrowDownLeft className="h-3.5 w-3.5 text-green-400" />
                      : <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{tx.description ?? formatType(tx.type)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono text-sm font-semibold ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                      {" "}
                      {tx.currency === "crowns" ? "👑" : "🪙"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{tx.balance_after.toLocaleString()} left</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
