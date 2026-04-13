# Bot Matchmaking Directive

## Purpose
This directive defines required production behavior for bot fallback in live matchmaking.

## Policy
- Matchmaking is server-authoritative; browser clients must call API routes only.
- Queues attempt human-vs-human matching first.
- Timed bot fallback is enabled when no human match is found:
  - `freestyle`: 20 seconds
  - `ranked`: 45 seconds
- Ranked bot battles are explicitly labeled and persisted as `is_bot_battle=true`.
- Ranked bot battles are MMR-neutral by default (`mmr_neutral=true`).

## Required Metadata
For every bot fallback battle, persist:
- `is_bot_battle`
- `bot_personality_id`
- `bot_difficulty`
- `fallback_reason` (`timed_bot_fallback`)
- `wait_time_ms`
- `mmr_neutral`

## Access and Security
- Bot battle creation must be executed only from server routes using service-role credentials.
- LiveKit participant tokens require authenticated users and room-scoped authorization.
- Participant tokens grant publish/subscribe; spectator tokens grant subscribe-only.

## Auditability
- API responses for enqueue/status must include:
  - `matched`
  - `battleId`
  - `isBotBattle`
  - `fallbackReason`
  - `waitTimeMs`
  - `queueType`
- Persisted battle fields must allow offline analysis for fallback rates and queue pressure.

## Anti-abuse
- No client-side service-role database access.
- No mock fallback in production battle paths.
- Idempotent finalize and rating application must remain enabled for safe retries.
