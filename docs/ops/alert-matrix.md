# Alert Matrix

Critical alerts:
- `health_endpoint_down`
  - trigger: `/api/health` non-200 or timeout
  - severity: critical
  - action: verify Render deploy status, env presence, recent logs
- `tournament_registration_rpc_failure_spike`
  - trigger: repeated `tournament_register_rpc_failed` or elevated non-2xx register responses
  - severity: critical
  - action: inspect RPC, token balance path, and DB latency
- `stripe_webhook_failure`
  - trigger: webhook route non-2xx or `payment_finalize_failed`
  - severity: critical
  - action: inspect Stripe delivery logs and `payment_ledger`
- `livekit_token_failure`
  - trigger: `LIVEKIT_TOKEN_FAILED` rate spike
  - severity: critical
  - action: inspect LiveKit env, battle participation auth, and token route logs
- `signup_or_auth_failure_spike`
  - trigger: repeated `auth_callback_exchange_failed` / auth callback error redirects
  - severity: warning
  - action: inspect Supabase auth callback behavior and provider status
- `queue_join_failure_spike`
  - trigger: repeated `matchmaking_enqueue_failed`
  - severity: warning
  - action: inspect queue table state and battle creation failures
- `purchase_failure_spike`
  - trigger: `PURCHASE_FAILED` or failed `payment_ledger` spikes
  - severity: critical
  - action: inspect Stripe intents, finalize RPC, and billing env
- `storage_failure`
  - trigger: beat upload/backfill storage errors or missing `BEATS_STORAGE_BUCKET`
  - severity: warning
  - action: inspect storage bucket health and upload permissions
- `5xx_rate_above_threshold`
  - trigger: error log volume spike by route
  - severity: critical
  - action: inspect structured error logs grouped by `route`
- `db_latency_above_threshold`
  - trigger: queue-to-match or RPC latency regression
  - severity: warning
  - action: inspect Supabase dashboards and expensive query paths

Current threshold defaults:
- `ttfm_p90 > 20000ms`
- `disconnect_rate > 8%`
- `governance_block_rate > 15%`
- any critical route returning sustained `5xx` over 5 minutes

Routing:
- privileged in-app notifications via `admin_audit_log`/notifications system
- optional webhook sink via `OPS_ALERT_WEBHOOK_URL`
