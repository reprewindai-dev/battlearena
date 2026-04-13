# Onboarding Event Map

Canonical activation event:
- a user completes their first battle
- or registers for their first tournament
- or completes their first purchase

Tracked telemetry events:
- `SIGNUP_STARTED`
- `SIGNUP_COMPLETED`
- `SIGNUP_FAILED`
- `LOGIN_COMPLETED`
- `LOGIN_FAILED`
- `PROFILE_COMPLETED`
- `QUEUE_ENTER`
- `MATCH_START`
- `MATCH_END`
- `TOURNAMENT_REGISTERED`
- `TOURNAMENT_REGISTRATION_FAILED`
- `CHECKOUT_STARTED`
- `PURCHASE_COMPLETED`
- `PURCHASE_FAILED`

Activation attribution:
- referral signup attribution is stored at signup/callback from `referral_code`
- referral activation is marked on:
  - battle finalize
  - tournament registration success
  - token purchase confirmation

First-session checklist:
- set up profile
- fund account
- enter first battle
- connect to community

Primary conversion path:
- `/signup`
- `/app/profile`
- `/app/battles`
- `/app/tournaments`
- `/app/shop`
- `/invite/<code>`
