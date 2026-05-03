# Economy — Future Improvement Notes

These are notes captured during a review of `src/lib/economy/wallet.ts` for future reference.

---

## What's Working Well

- Dual-currency model (Crowns = reputation, Tokens = purchasable) is solid and healthy
- `transact()` function is atomic and audit-ready — every event is traceable via `wallet_transactions`
- `Math.max(0, ...)` floor prevents negative balances cleanly
- Lifetime balance tracking is already in place — good foundation for milestones and loyalty mechanics

---

## Gaps to Address Later

### 1. Crown Spending (Sink)
Crowns can be earned but there is no spend path yet. Without a sink, Crown inflation will make them worthless over time.
**Suggested sinks:** cosmetics, featured battle status, special battle modes, profile badges, leaderboard boosts.

### 2. Token Purchase Webhook
The `purchase` transaction type exists in the type union but confirm the Stripe webhook in `src/lib/payments/` is correctly calling `transact()` with `type: 'purchase'` after a successful charge.

### 3. Move Reward Rates to Config Table
Currently hardcoded:
```ts
const CROWNS_PER_WIN = 10;
const TOKENS_PER_BATTLE = 2;
```
Move these to a `economy_config` Supabase table so rates can be tuned without a redeploy.

### 4. Daily Login Crown Function
`crown_daily_login` is defined as a `TransactionType` but `awardDailyLoginCrowns()` is not yet implemented in `wallet.ts`. Add it when the login/session flow is wired up.

### 5. Referral Crown Function
Same as above — `crown_referral` type exists but no `awardReferralCrowns()` function yet.

---

## Transferable Architecture

This economy pattern (wallet, dual-currency, governance, usage tracking, payments, telemetry) is directly reusable in other products — Veklom marketplace tools, GitHub Action wrappers, SaaS products, etc.
