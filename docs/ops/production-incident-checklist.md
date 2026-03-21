# Production Incident Checklist

1. Confirm scope
- affected route(s)
- first observed timestamp
- blast radius: auth, queue, battle, tournament, payment, storage

2. Check health
- hit `/api/health`
- confirm `version`
- confirm `checks` and `missingChecks`

3. Inspect structured logs
- search by `route`
- search by `request_id`
- search by `user_id`, `battle_id`, `tournament_id`, or `stripe_event_id` as applicable

4. Check dependent systems
- Supabase auth/db/storage
- LiveKit token issuance
- Stripe webhook delivery and payment intents
- Render deploy/restart state

5. Contain
- disable broken operator workflow if it is retrying dangerously
- stop non-essential background jobs if they amplify failure
- switch operators to read-only workflows if data integrity is at risk

6. Recover
- redeploy only after identifying the failure signature
- rerun critical runtime checks:
  - queue join
  - live room join
  - tournament registration
  - token purchase confirm

7. Record
- incident start and end times
- root cause
- user-visible impact
- corrective action
- follow-up task owner
