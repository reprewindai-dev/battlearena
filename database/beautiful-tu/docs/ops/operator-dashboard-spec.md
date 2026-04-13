# Operator Dashboard Spec

Canonical data source:
- `GET /api/admin/telemetry/dashboard?hours=24`

Sections:
- Activation
  - `signup_completed`
  - `profile_completed`
  - `activated_total`
- Queue
  - `queue_joined`
  - `ttfm_p50`
  - `ttfm_p90`
  - `ttfm_p95`
  - `ttfm_p99`
- Battles
  - `battle_started`
  - `battle_completed`
  - `rematch_rate`
  - `rage_quit_rate`
  - `disconnect_rate`
- Tournaments
  - `tournament_registered`
- Revenue
  - `checkout_started`
  - `purchase_completed`
  - `purchase_failed`
  - `ledger_succeeded`
  - `ledger_failed`
- Infrastructure
  - `livekit_token_issued`
  - `livekit_token_failed`
  - `governance_block_rate`
  - `circuit_breaker_open_rate`
  - `fairness_violation_rate`

Operator views:
- `24h` default
- `1h` incident view
- `7d` trend view

Required filters:
- time window only for v1
- v2 should add user, battle, tournament, and payment drill-down keyed off structured logs
