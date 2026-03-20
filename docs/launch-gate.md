# Launch Gate

## Scope
This gate tracks the production launch state of the Battle Arena web runtime deployed from the repository root at `C:\Users\antho\.windsurf\battlearena\battlearena`.

Canonical runtime decisions:
- Live battle runtime: `/app/battles/room`
- Billing APIs: `/api/subscriptions/create`, `/api/subscriptions/portal`, `/api/economy/tokens/purchase`, `/api/economy/tokens/confirm`, `/api/stripe/webhook`
- Token spend source: `user_profiles.token_balance`
- Deployment target: Render web service `battlearena-web`

## Required Runtime Environment
Required in production:
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_BILLING_WEBHOOK_SECRET`
- `STRIPE_PRICE_SUB_SPECTATOR_MONTHLY`
- `STRIPE_PRICE_SUB_PRO_MONTHLY`
- `STRIPE_PRICE_SUB_PREMIUM_MONTHLY`
- `BEATS_STORAGE_BUCKET`
- `SERVER_SIGNATURE_SECRET`
- `CRON_CLEANUP_SECRET`

Governance controls:
- `GOV_ENABLED=true`
- `GOV_TRACE_ONLY=false`
- `GOV_ENFORCE_BLOCKS=true`

## Required Database State
Required migrations and database contracts:
- Supabase migrations under `supabase/migrations`
- RPCs used by runtime flows must exist:
  - `increment_user_token_balance`
  - `spend_user_token_balance`
  - `finalize_token_purchase_ledger`
  - `record_battle_result`
  - `apply_battle_elo_ratings`
- Required tables/views used by current runtime:
  - `users`
  - `user_profiles`
  - `user_billing_profiles`
  - `payment_ledger`
  - `battles`
  - `battle_participants`
  - `matchmaking_queue`
  - `tournaments`
  - `tournament_registrations`
  - `moderation_cases`
  - `notifications`
  - `player_stats`
  - `user_achievements`

## Verified Checks
Static verification completed on the current codebase:
- `npm run typecheck`
- `npm run lint`
- `NODE_OPTIONS=--max-old-space-size=1024 npm run build`

Recent runtime verification completed:
- Render production health endpoint returns `ok`
- Render production commit is live on `4c56613de3184b7a4940ab9bf86709d6d076336f`
- Health response currently reports dependencies healthy:
  - `supabase: true`
  - `livekit: true`
  - `stripe: true`
- Production token shop uses a real Stripe Payment Element flow
- Production billing page uses a real Stripe Payment Element flow for incomplete subscription payments
- Production webhook route accepts either payment or billing webhook signatures
- Battle runtime routes are normalized:
  - `/app/battles/room` is the runtime
  - `/app/battles/pvp` redirects to room
  - `/app/battles/bot-room/[battleId]` redirects to room with `battleId`
- Matched battles promote to `live` on room join instead of remaining stuck in `matched`
- Live Render smoke suite passes unauthenticated paths against production:
  - `4 passed`
  - `4 skipped`

Recent workflow hardening completed:
- `Battle Arena CI` passes on current `main`
- `Battle Arena E2E` passes on current `main`
- `Cleanup stale battle recordings` passes on current `main`
- `CodeQL` passes on current `main`
- manual Render smoke action exists at `.github/workflows/render-live-smoke.yml`
- manual Render live video action exists at `.github/workflows/render-live-video.yml`
- manual Render matchmaking bot action exists at `.github/workflows/render-matchmaking-bot.yml`
- manual Render beats runtime action exists at `.github/workflows/render-beats-runtime.yml`
- manual Render tournaments runtime action exists at `.github/workflows/render-tournaments-runtime.yml`
- automated two-user live battle video verification passed against Render via GitHub Actions
- automated timed bot fallback verification passed against Render for:
  - freestyle bot fallback contract
  - ranked MMR-neutral bot fallback contract
- automated beat runtime verification passed against Render for:
  - admin-only upload enforcement
  - storage-backed beat persistence
  - beat library visibility
  - public asset fetchability for audio and preview URLs
- automated tournament runtime verification passed against Render for:
  - admin-created tournament registration flow
  - canonical `user_profiles.token_balance` debit on entry
  - duplicate registration does not double-charge

## Blocked Or Not Yet Fully Proven
These items are not signed off yet:
- full Stripe webhook-to-profile reconciliation verification in production after live payment events
- tournament refund-path verification after a downstream registration failure
- Docker Scout image scan rerun after local Docker service stability is restored
- direct confirmation that Render has `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set in the live service env

## Current Risks
Open launch risks that must be cleared before calling the build 100 percent complete:
- runtime verification still depends on real provider credentials and a stable browser automation environment
- authenticated smoke and matchmaking verification require real GitHub Actions or local test credentials
- local Docker instability has blocked repeatable LiveKit container verification on this machine
- several older status documents in the repo overstate completion and should not be treated as proof of launch readiness

## Release Gate Status
Current gate: `YELLOW`

Meaning:
- code compiles, builds, deploys, and serves production traffic
- workflow health is green on the current repo baseline
- critical checkout/runtime defects have been removed
- production is not yet signed off for 100 percent completion because the blocked runtime proofs above are still open

## Exit Criteria For Green
The gate turns green only when all of the following are complete:
- latest GitHub Actions CI and security workflows pass on current `main`
- production Render environment includes all required vars, including `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- real two-user battle flow is verified end to end
- timed bot fallback is verified end to end for casual and ranked paths
- live payment purchase and subscription payment are verified through webhook reconciliation
- tournament token debit/refund path is verified against canonical profile balance
- storage-backed beat upload and playback are verified in production
- no remaining high-severity launch blockers are open
