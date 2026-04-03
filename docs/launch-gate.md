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
  - `tournament_participants`
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
- Live Render smoke suite has passed against production in prior verified runs:
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
- automated two-user live battle video verification has passed against Render in prior verified runs
- automated timed bot fallback verification has passed against Render for:
  - freestyle bot fallback contract
  - ranked MMR-neutral bot fallback contract
- automated beat runtime verification has passed against Render for:
  - admin-only upload enforcement
  - storage-backed beat persistence
  - beat library visibility
  - public asset fetchability for audio and preview URLs
- automated tournament runtime verification has passed against Render for:
  - admin-created tournament registration flow
  - canonical `user_profiles.token_balance` debit on entry
  - duplicate registration does not double-charge
- tournament registration is now enforced by atomic database RPC:
  - `register_tournament_participant_runtime`
  - participant insert and token debit occur inside the same database transaction
- automated Stripe runtime verification has passed against Render for:
  - token purchase webhook reconciliation into `payment_ledger`
  - token balance/profile reconciliation after purchase
  - subscription webhook reconciliation into `user_billing_profiles`
  - live token shop Payment Element mount on production
- Docker Scout production image scan completed on the patched Docker build:
  - scanned image digest `93df5874a7ed1a48411dbb6e0d443ba4b627ca9969ffea08975b56cff0dd6539`
  - result: `0 critical`, `0 high`

## Blocked Or Not Yet Fully Proven
These items are not signed off yet:
- current live deployment version must match the repo commit under test

## Current Risks
Open launch risks that must be cleared before calling the build 100 percent complete:
- older status documents in the repo should not be treated as stronger proof than this launch gate

## Release Gate Status
Current gate: `CONDITIONAL`

Meaning:
- code compiles, builds, and has prior successful live verification evidence
- critical checkout/runtime defects have been removed from the repo baseline
- production is only considered green when `/api/health.version` matches the exact commit under test
- a stale Render deployment is a launch blocker even if dependency checks remain green

## Exit Criteria For Green
The gate turns green only when all of the following are complete:
- latest GitHub Actions CI and security workflows pass on current `main`
- Render runtime verification workflows fail on deployment-version mismatch
- production Render environment includes all required vars
- real two-user battle flow is verified end to end
- timed bot fallback is verified end to end for casual and ranked paths
- live payment purchase and subscription payment are verified through webhook reconciliation
- tournament token debit/refund path is verified against canonical profile balance
- storage-backed beat upload and playback are verified in production
- no remaining high-severity launch blockers are open

