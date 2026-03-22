# Notifications Matrix

System notifications currently emitted:

- Welcome
  - trigger: first onboarding state hydration with no existing welcome marker
  - destination: `notifications`
  - link: `/app`

- Purchase confirmed
  - trigger: successful token purchase confirmation
  - destination: `notifications`
  - link: `/app/shop`

- Tournament registration confirmed
  - trigger: successful tournament registration
  - destination: `notifications`
  - link: `/app/tournaments`

Existing social/runtime notifications already present:
- follow
- challenge
- battle invite
- moderation

Alerting destinations:
- privileged in-app notifications for admin/mod users
- optional webhook sink via `OPS_ALERT_WEBHOOK_URL`
