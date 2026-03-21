# Logging Schema

Canonical structured log fields:
- `timestamp`
- `severity`
- `message`
- `request_id`
- `route`
- `environment`
- `user_id`
- `tournament_id`
- `battle_id`
- `stripe_event_id`

Route-level expectations:
- every API error path logs one structured error event
- success logs are emitted for queue join, tournament registration, checkout start, purchase confirmation, LiveKit token issuance, and profile completion
- request correlation uses `x-request-id` when present and falls back to generated ids

Severity rules:
- `info`: normal lifecycle transitions and successful monetization/runtime actions
- `warn`: validation failures, forbidden access, missing prerequisites, recoverable business-rule rejections
- `error`: upstream failures, persistence failures, webhook failures, token issuance failures, unexpected exceptions

Search keys for operators:
- by route: `route=/api/economy/tokens/confirm`
- by user: `user_id=<uuid>`
- by tournament: `tournament_id=<uuid>`
- by battle: `battle_id=<uuid>`
- by payment provider event: `stripe_event_id=<id>`
