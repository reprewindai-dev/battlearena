# Referral Data Model

Tables:

## `public.referral_invites`
- `id`
- `inviter_user_id`
- `code`
- `label`
- `clicks`
- `signups`
- `activations`
- `last_clicked_at`
- `last_signup_at`
- `created_at`
- `updated_at`

## `public.user_referrals`
- `id`
- `invite_id`
- `inviter_user_id`
- `referred_user_id`
- `status`
- `activation_event`
- `activated_at`
- `created_at`
- `updated_at`

Runtime rules:
- one referred user may only be attributed once
- self-referrals are rejected
- invite clicks are counted on `/invite/<code>`
- signup attribution is applied on signup and auth callback
- activation is idempotently marked on first battle, first tournament registration, or first purchase

User-facing contract:
- authenticated users can fetch their own invite stats from `/api/referrals`
- invite links use `/invite/<code>` and redirect to `/signup?invite=<code>`
