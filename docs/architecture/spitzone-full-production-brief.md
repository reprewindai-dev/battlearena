# Spitzone Full Production Brief

## 1. Executive Summary

Spitzone is a real-time battle network designed to replace passive scrolling with active participation. At its core, it is a live competitive media product where users do not just consume content; they enter rooms, battle, spectate, rank up, spend, earn, refer, organize, and return.

In finished form, Spitzone is not only a battle app. It is a full creator arena with:
- live battle sessions
- queue-based matchmaking
- direct challenges
- tournament infrastructure
- beat catalog and content inventory
- community identity systems
- monetized token and subscription economy
- moderation and governance controls
- referral and onboarding loops
- telemetry, alerts, and operator tooling
- future battle-native content clipping and distribution

The product thesis is direct: TikTok, Bigo, and similar platforms optimize for passive feed consumption. Spitzone can win a narrower but more defensible space by optimizing for live competitive participation, creator identity, and monetized community energy.

## 2. What Spitzone Is Today

The current codebase is already a functioning full-stack product, not a landing-page shell.

Current implemented surfaces in the authenticated app include:
- home
- community
- battle lobby
- leaderboard
- tournaments
- challenges
- shop
- profile
- battle history
- search
- beat library
- moderation
- admin

Current implemented API domains include:
- admin
- analytics
- auth
- battle-session
- battles
- beats
- billing
- challenges
- community
- economy
- health
- livekit
- lobbies
- matchmaking
- moderation
- notifications
- onboarding
- profile
- referrals
- rooms
- search
- session
- stripe
- subscriptions
- tournaments
- usage
- users

Current production data model already exists for:
- users and public profiles
- ratings and wallets
- battles, battle participants, battle votes, battle sessions, battle rounds
- matchmaking queue
- beats and beat reviews
- challenges
- tournaments and brackets
- crews, mentorships, community events, follows, notifications
- referrals and onboarding progress
- payment ledger, token purchases, token transactions, payouts, billing profiles
- moderation, AI flags, governance circuit breaker, fairness monitoring
- telemetry events and idempotency controls

Live database inventory at time of writing includes:
- 106 users
- 78 beats
- 14 crews
- 12 mentorships
- 12 community events
- 17 notifications
- 7 challenges
- 68 telemetry events
- 5 battles

That means Spitzone is already beyond concept stage. It is now in launch-hardening and scale-hardening territory.

## 3. What Spitzone Becomes At Full Production

At full production maturity, Spitzone becomes a creator competition network with four reinforcing loops.

### 3.1 Participation Loop
- user signs up
- completes profile
- enters battle queue or joins a room
- battles or spectates
- gains rank, identity, and community presence
- returns to improve status and visibility

### 3.2 Monetization Loop
- user buys tokens or subscription access
- spends on entry, access, room control, premium features, support, boosts, or events
- platform takes margin
- creators earn points or payouts
- stronger creators pull in more audience and spend

### 3.3 Social Retention Loop
- users join crews, mentorships, events, and community feeds
- invite/referral links pull in friends and collaborators
- repeated live interaction builds regulars, not one-off visitors

### 3.4 Content Distribution Loop
- battles produce shareable moments
- future ClipCrafter-style battle-native clipping converts live sessions into short-form content
- creators distribute highlights externally
- new viewers discover Spitzone through creator output
- distribution feeds signups and battle demand

When all four loops are working together, Spitzone stops being just a venue and becomes a self-reinforcing creator economy system.

## 4. Core Product Capabilities

### 4.1 Identity and Access
Spitzone uses Supabase-backed authentication and session handling. Users can:
- sign up
- log in
- persist sessions
- manage profiles
- maintain public identity
- retain onboarding and billing state

The production auth path already supports live login, account access, profile reads, and profile writes.

### 4.2 Battle System
The battle system is the core product engine.

Current battle capabilities include:
- battle creation
- battle join as participant B
- battle status transitions
- battle finalization
- live room entry
- battle history
- recent sessions
- real-time session metadata refresh
- LiveKit token issuance for valid participants

Battle modes currently represented in the system:
- freestyle
- ranked
- tournament

Matchmaking behavior already supports:
- queue entry
- queue polling
- human match creation
- timed bot fallback
- idempotent queue operations

Current queue rules in code:
- freestyle bot fallback after 20 seconds
- ranked bot fallback after 45 seconds
- ranked bot fallback is MMR-neutral

### 4.3 Real-Time Media Layer
The media layer is currently LiveKit-backed for battle participation.

Current live session rules:
- only authenticated users can request tokens
- only participants or battle owners can receive join tokens
- spectators are explicitly blocked from participant tokens in the current route
- token issuance and failure are tracked in telemetry

This gives Spitzone a real low-latency battle transport foundation, not a fake demo room.

### 4.4 Community System
Community is not just a side feed. It is part of retention.

Current community surfaces include:
- community feed
- leaderboard
- crews
- mentorships
- community events
- follows
- notifications

The intended behavior is closer to a venue/community hybrid than a generic social feed.

### 4.5 Beats and Content Inventory
The beats system is production-relevant and already hardened.

Current capabilities:
- beats table populated with real inventory
- beat verification script
- quarantine for malformed or fake legacy rows
- storage bucket integration
- beat library surface in-app

Current verified catalog state:
- 78 total beats in the database
- 73 launch-safe active verified beats after cleanup
- placeholder inventory quarantined out of the live catalog

This matters because empty content kills battle products. Spitzone no longer has that problem.

### 4.6 Tournaments
Tournament infrastructure exists today.

Current capabilities:
- tournament listing
- tournament creation
- registration flow
- participant tracking
- bracket tables
- entry fee and prize pool fields
- tournament registration confirmation notifications
- activation tracking tied to registration

This gives Spitzone a path from everyday queue battles to structured events and higher-value competition.

### 4.7 Monetization and Billing
The current product already includes real monetization runtime.

Current monetization surfaces:
- token pack purchases
- subscription creation
- Stripe payment element flow
- Stripe webhook handling
- payment ledger
- token purchase finalization via database RPC
- billing profile persistence
- purchase notifications
- usage/access gating hooks

Current token packs in the UI:
- 100 tokens / $4.99
- 250 tokens / $9.99
- 500 tokens / $19.99
- 1000 tokens / $34.99
- 2500 tokens / $79.99

Current subscription tiers in the UI:
- Spectator Pass / $4.99 monthly
- Pro Creator / $9.99 monthly
- Premium Battle / $19.99 monthly

Current subscription positioning:
- Spectator: exclusive battle viewing, archives, profile badge
- Pro: analytics, higher payout rate, priority matchmaking, custom rooms
- Premium: unlimited battle creation, tournament priority, exclusive beat library, moderation tools, premium support

### 4.8 Growth and Referrals
Growth runtime is not hypothetical. It is already wired.

Current growth capabilities:
- invite code generation and stats
- `/invite/<code>` attribution path
- referral click tracking
- signup attribution
- activation marking on first battle, tournament registration, or purchase
- onboarding checklist
- welcome notifications
- activation telemetry

This matters because the app is not relying only on paid acquisition. It has an internal mechanism to turn existing users into acquisition nodes.

### 4.9 Telemetry and Operator Control
Spitzone already has a serious telemetry layer.

Tracked event types include:
- signup started/completed/failed
- login completed/failed
- profile completed
- queue enter
- queue match found
- match start/end
- tournament registered/failed
- checkout started
- purchase completed/failed
- LiveKit token issued/failed
- rematch shown/accepted
- disconnects
- rage quit
- TTFM
- governance blocks
- circuit breaker open
- fairness violation

Derived operational metrics include:
- TTFM percentiles
- rematch rate
- rage-quit rate
- disconnect rate
- governance block rate
- fairness violation rate

This is a strong production signal. Most early-stage products do not instrument their core funnel and failure modes this deeply.

## 5. Frontend Architecture

### 5.1 Current Frontend Stack
The frontend is built on:
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Zustand
- Framer Motion
- TanStack Query
- shadcn-style UI primitives

### 5.2 Frontend Responsibilities
The frontend handles:
- authenticated shell and navigation
- battle lobby and queue entry
- battle room experience and session persistence
- community feed and social surfaces
- tournament browsing and registration
- token shop and subscription UI
- profile and notifications
- referral card and onboarding checklist
- visual brand system and premium design language

### 5.3 Current UX Structure
The authenticated shell is already organized as a network map with direct routes to:
- Home
- Community
- Battle Lobby
- Leaderboard
- Tournaments
- Challenges
- Shop
- My Profile
- Battle History
- Search
- Beat Library
- Moderation
- Admin Panel

That means the product is structurally closer to a platform dashboard than a single-purpose streaming page.

### 5.4 Design System Direction
The current visual direction is now deliberately premium and non-template:
- dark, high-contrast arena aesthetic
- signal/frequency branding layer
- premium commerce UI
- raw street energy without generic SaaS blandness
- room-first rather than feed-first feeling

The next design maturation step is not reinvention. It is consistency across all remaining secondary screens and states.

## 6. Backend Architecture

### 6.1 Current Backend Reality
The current deployed product is best understood as a full-stack monolith with strong service boundaries in code, not a true microservices system yet.

Current backend stack includes:
- Next.js app router server routes
- Supabase for auth, Postgres, and some realtime/state persistence
- LiveKit for real-time media
- Stripe for billing
- structured logging
- telemetry event storage
- typed service modules under `src/lib/*`

This is important: the current implementation is more practical than the aspirational docs. It is a monolith with modular domains. That is a good choice at this stage because it keeps product velocity high.

### 6.2 Current Backend Domains
The codebase is organized into real backend domains:
- auth
- battle
- beats
- billing
- community
- growth
- governance
- livekit
- logging
- matchmaking
- notifications
- onboarding
- payments
- supabase
- telemetry
- usage
- users

This domain structure is the right foundation for eventual service extraction.

### 6.3 Data Layer
Primary data layer today:
- Supabase Postgres as system of record
- object storage for beats/media inventory
- LiveKit media infrastructure for live room transport
- Stripe external billing rail

Critical tables currently present:
- `users`
- `user_profiles`
- `user_ratings`
- `wallets`
- `battles`
- `battle_participants`
- `battle_votes`
- `battle_rounds`
- `battle_sessions`
- `matchmaking_queue`
- `beats`
- `challenges`
- `crews`
- `crew_members`
- `mentorships`
- `community_events`
- `notifications`
- `referral_invites`
- `user_referrals`
- `payment_ledger`
- `token_purchases`
- `token_transactions`
- `user_billing_profiles`
- `telemetry_events`
- `moderation_actions`
- `moderation_cases`
- `moderation_reports`
- `ai_moderation_flags`
- `fairness_monitoring`
- `governance_circuit_breaker_state`
- `idempotency_keys`

### 6.4 Health and Runtime Dependencies
The current health model verifies production-critical dependencies:
- app runtime
- Supabase
- storage
- LiveKit
- Stripe

That is the correct dependency surface for the current product shape.

## 7. Infrastructure, Deployment, and Runtime Dependencies

### 7.1 Current Deployment Shape
The current production deployment model is:
- Render-hosted web runtime
- Next.js application server as the main app runtime
- Supabase as auth + Postgres + storage control plane
- LiveKit cloud for realtime media
- Stripe for payments and subscription billing

This is a practical launch-stage stack because it keeps the product in one main deployable unit while outsourcing the most difficult specialist infrastructure:
- auth and database operations to Supabase
- low-latency media transport to LiveKit
- billing and checkout rails to Stripe

### 7.2 Current Required Production Dependencies
The live health route currently checks for:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` or equivalent service key
- `BEATS_STORAGE_BUCKET`
- `NEXT_PUBLIC_LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` or `STRIPE_BILLING_WEBHOOK_SECRET`

The billing runtime also depends on subscription price configuration for:
- spectator monthly price
- pro monthly price
- premium monthly price

### 7.3 Finished Production Infrastructure
At mature production scale, Spitzone should operate with:
- web edge/CDN for static assets
- app runtime layer for authenticated and business logic flows
- queue/worker layer for non-request-bound processing
- database primary + replicas
- object storage for audio, beats, recordings, replays, clip exports
- realtime media provider or self-managed SFU layer
- observability stack for metrics, traces, logs, and alert routing
- secrets management and environment separation

### 7.4 Background Job Layer Needed For Maturity
The current product can launch without a huge job system, but mature production will need workers for:
- payment reconciliation retries
- notification fanout
- beat verification and asset processing
- tournament bracket generation
- telemetry aggregation
- moderation and review jobs
- future replay encoding and clip generation

### 7.5 Backup and Recovery Requirements
For serious production operation, the platform needs:
- daily Postgres backup verification
- storage bucket lifecycle and restore process
- Stripe and billing ledger reconciliation playbook
- disaster recovery procedure for auth/session failures
- incident runbooks for LiveKit degradation or Stripe webhook lag
- environment rollback discipline with known-good deploy tags

## 8. Security, Trust, and Compliance Model

### 8.1 Current Security Posture In Code
The current system already shows correct production instincts:
- session-based auth and protected app routes
- service-role access isolated to backend runtime
- zod validation on critical billing routes
- idempotency controls for payments and queue actions
- health checks for core dependencies
- structured request logging
- payment finalization separated from client initiation

### 8.2 Production Security Requirements
A fully mature Spitzone deployment should enforce:
- strict route authorization for admin and moderation surfaces
- rate limiting on auth, referrals, queueing, search, and payment routes
- replay-safe webhook processing
- strict input validation on every mutating route
- secrets isolated to server runtime only
- audit logging for admin and moderation actions
- abuse detection across auth, payments, and battle manipulation

### 8.3 Trust and Safety Requirements
Because Spitzone is live, competitive, and monetized, trust is a product requirement. The final system must handle:
- harassment and slur reporting
- fraud and refund abuse
- sockpuppet and vote manipulation
- collusion in ranked modes
- challenge griefing
- spam invites and referral farming
- creator impersonation

### 8.4 Compliance Realities
If the product reaches meaningful revenue scale, it will need operational policies and tooling around:
- age gating where required
- payout/KYC controls for creators receiving cash value
- tax reporting for payouts
- platform terms enforcement
- digital goods billing compliance across app stores if native mobile distribution becomes core
- privacy and data retention standards for user content, room logs, and recordings

## 9. End-to-End User Loops

### 9.1 New User Activation Loop
The current canonical activation path is:
- `/signup`
- `/app/profile`
- `/app/battles`
- `/app/tournaments`
- `/app/shop`
- `/invite/<code>`

Current activation definition is met when the user:
- completes first battle
- or registers for first tournament
- or completes first purchase

### 9.2 Battle Loop
The battle loop works like this:
- user opens battle lobby
- chooses freestyle or ranked queue
- queue state is persisted and polled
- if a human opponent is found, a battle is created
- if not, a bot fallback can keep momentum alive
- user enters room
- session metadata loads from backend
- battle can go live
- battle finalizes and results persist
- telemetry records the session
- user can requeue or move into follow-up loops

### 9.3 Tournament Loop
The tournament loop works like this:
- user browses tournaments
- user creates or joins tournament
- registration updates database
- notification confirms registration
- referral activation can be marked
- tournament detail becomes next event state

### 9.4 Revenue Loop
Current revenue loop:
- user enters shop
- chooses token pack or subscription
- Stripe client secret is created server-side
- payment element renders in-app
- Stripe webhook and confirmation route finalize state
- payment ledger updates
- tokens or subscription status unlock access
- telemetry records purchase funnel
- notifications confirm completion

### 9.5 Referral Loop
Current referral loop:
- inviter creates or shares invite link
- recipient lands on `/invite/<code>`
- click is counted
- signup attribution is stored
- first activation event ties back to inviter
- inviter can view stats from `/api/referrals`

## 10. Monetization Model

Spitzone should be treated as a multi-layer business, not a single monetization feature.

### 10.1 Revenue Layer 1: Tokens
Use cases:
- battle access
- premium room controls
- tipping/support
- tournament fees
- premium features and boosts

This is the fastest direct consumer revenue layer.

### 10.2 Revenue Layer 2: Subscriptions
Use cases:
- ad-light/ad-free experience
- creator analytics
- advanced room control
- priority access
- exclusive content and beats
- creator and operator tools

This creates predictable recurring revenue.

### 10.3 Revenue Layer 3: Events and Tournaments
Use cases:
- premium brackets
- branded or sponsored tournaments
- special-entry events
- finals and premium viewing experiences

This supports event-based spikes in revenue and attention.

### 10.4 Revenue Layer 4: Creator Economy Margin
Long-term, the real engine is not only selling access. It is taking structured margin on creator activity:
- tips
- rooms
- premium battles
- subscriptions
- promotional placement
- sponsorship and brand deals

### 10.5 Revenue Layer 5: Future ClipCrafter Content Engine
This is a serious future business line.

ClipCrafter should not compete as a generic Opus clone. It should be battle-native.

Future ClipCrafter V1 inside Spitzone should:
- auto-record completed battles
- detect highlight moments using battle timing, votes, transcript intensity, and reactions
- generate short vertical clips
- burn captions in
- rank moments by likely share value
- package clips for TikTok, Shorts, and Reels

That creates:
- creator retention
- organic growth distribution
- export monetization
- future standalone SaaS potential

## 11. Admin, Governance, and Safety

A live competitive platform cannot scale on product alone. It needs operational control.

### 11.1 Current Control Surfaces
Current data model already supports:
- moderation reports
- moderation actions
- moderation cases
- AI moderation flags
- governance circuit breaker state
- fairness monitoring
- user moderation history
- telemetry-based alerts

### 11.2 Why This Matters
If Spitzone grows, the product will face:
- abuse
- harassment
- rigging accusations
- spam
- room griefing
- payment fraud
- sockpuppet behavior
- fairness disputes

The current codebase already reflects awareness of these risks. That is a major strength.

### 11.3 Full Production Requirement
To be category-leading, governance and safety must become visible product features, not invisible admin-only mechanics:
- fast reporting
- trusted role indicators
- room rules surface
- clear consequences
- fast moderator tooling
- fraud controls in payments and referrals
- fairness review for ranked ladders and tournaments

## 12. Can It Stand One Million Users?

### 12.1 Honest Answer
Not in its current exact deployed shape.

The current monolithic Next.js + Supabase + LiveKit + Stripe architecture is a strong launch-stage architecture, but it is not the final form for one million active users with heavy live concurrency.

If you mean:
- one million total registered users over time: yes, absolutely achievable with staged hardening
- one million monthly active users: possible with architectural evolution
- one million concurrent live battle users: not with the current monolith

### 12.2 What Breaks First
At true large scale, the first pressure points will be:
- real-time fanout and room-state broadcast volume
- queue throughput and lock contention
- battle state persistence frequency
- notification/event write amplification
- battle metadata fetch patterns
- database connection pressure
- media/session coordination under peak live traffic
- admin/moderation operations volume

### 12.3 Current Scale Signals In Code
The codebase already contains scale awareness in `BattleScalabilityAudit`:
- concurrent battle threshold planning around 1000 active battles
- spectator threshold planning around 100 per battle
- message throughput threshold around 1000/sec
- mitigations for state diffs, client-side countdowns, limited presence tracking, caching, and read replicas

That means the product is already thinking about operational scale, but it is not yet fully built for hyperscale.

### 12.4 What Must Change To Reach 1M-Class Platform Scale
To reach million-user-class scale, Spitzone should evolve in stages.

#### Stage 1: Harden the Monolith
- keep Next.js app + modular service boundaries
- push more reads behind caching
- reduce high-frequency write patterns
- use background jobs for non-request-bound flows
- introduce explicit rate limiting
- improve operator dashboards and alerts

#### Stage 2: Introduce Realtime and Queue Infrastructure
- dedicated queue service or worker tier
- Redis for high-speed queue/presence caches
- append-only event stream for battle state changes
- lower-frequency durable writes to Postgres
- realtime diff delivery instead of full-state chatter

#### Stage 3: Separate Heavy Domains
Extract high-load domains into dedicated services:
- matchmaking service
- battle orchestration service
- telemetry/event ingestion service
- notification service
- billing service
- content/clip processing service

#### Stage 4: Multi-Region and Event-Driven Scale
- regional room placement
- read replicas and partitioning
- CDN-backed media assets
- queue/event bus
- autoscaled worker pools
- dedicated observability, SLOs, and rollback controls

### 12.5 Bottom Line On Scale
Spitzone can become a million-user platform, but only if you treat the current codebase as the launch kernel, not the terminal architecture.

That is normal. TikTok, Twitch, Discord, and Bigo did not start at hyperscale architecture on day one either.

## 13. Can It Sit Next To TikTok Live Or BIGO Live?

### 13.1 Honest Competitive Position
Not as a direct substitute today.

TikTok Live and BIGO Live already operate at massive distribution, recommendation, creator liquidity, and infrastructure scale. Spitzone cannot beat them by trying to be a generic live platform.

### 13.2 Where Spitzone Can Compete
Spitzone can compete where those platforms are structurally weaker:
- live competitive identity
- battle-first room design
- skill-based progression
- clear stakes and outcomes
- creator monetization tied to performance and community
- rooms that feel like scene infrastructure, not disposable streams
- beat catalog and culture-native features
- future battle-native clip engine

### 13.3 Category Positioning
The right frame is:
- TikTok Live = mass-market algorithmic live feed
- BIGO Live = broad live creator platform
- Spitzone = premium live competitive culture network

### 13.4 Real Strategic Advantage
Spitzone’s moat is not scale first. It is product fit:
- battle-native loop
- monetization tied to room culture
- identity and status systems
- event and tournament ladder
- creator export engine later

That is a sharper wedge than trying to out-feed TikTok.

## 14. What The Finished Frontend Will Consist Of

A finished Spitzone frontend should include these fully mature surfaces:
- guest landing and acquisition flow
- signup/login/onboarding
- home command surface
- community feed
- live battle lobby
- active battle room
- battle history and replays
- beat library
- challenges and callouts
- tournament listings, detail, and brackets
- profile and creator identity
- notifications center
- token shop and subscription management
- billing and receipts
- search and discovery
- moderation tooling
- admin/operator tooling
- referral dashboard
- future clip library and export center

The frontend should ultimately feel like a venue OS, not just a web app.

## 15. What The Finished Backend Will Consist Of

A fully mature Spitzone backend should consist of:
- auth/session service
- user/profile service
- battle orchestration service
- matchmaking service
- realtime session/media coordination
- tournament service
- beats/content service
- billing and ledger service
- referral/growth service
- notifications service
- moderation/governance service
- telemetry/event ingestion service
- analytics warehouse pipeline
- future clip generation/export pipeline

Even if those stay within one repo for a while, these are the real service boundaries.

## 16. Full Production End-to-End Loop

This is the finished business loop.

### 16.1 Acquire
- social content
- creator referrals
- event promotion
- word of mouth from crews and battlers
- future auto-clipped battle distribution

### 16.2 Activate
- signup
- profile completion
- first room entry
- first battle or tournament registration
- first purchase or premium unlock

### 16.3 Retain
- rematches
- ranked progress
- crew affiliation
- recurring tournaments
- notifications
- content inventory
- creator status and audience identity

### 16.4 Monetize
- token sales
- subscriptions
- premium events
- room monetization
- creator economy margin
- future clip and export tools

### 16.5 Expand
- stronger creators attract audiences
- audiences convert into battlers and spenders
- content exports create external discovery
- community structures increase switching costs
- brand becomes a scene, not just an app

That is the full production loop.

## 17. Main Risks

The real risks are not conceptual. They are execution risks.

### 17.1 Product Risks
- dead lobbies
- low concurrency at launch windows
- poor battle quality control
- confusion around ranked vs casual vs room flows
- weak creator incentives

### 17.2 Technical Risks
- realtime instability
- queue inconsistency under load
- payment edge cases
- moderation lag
- telemetry blind spots
- scale bottlenecks from too many synchronous writes

### 17.3 Business Risks
- trying to be too broad too early
- competing with giant generalist platforms on their terms
- weak content distribution outside the app
- creator acquisition cost exceeding LTV

## 18. Highest-Leverage Future Additions

In order of leverage after launch stability:
- repeated live battle proof and operator tooling
- better room and spectator UX plus replay library
- creator analytics worth paying for
- premium tournaments and event packaging
- ClipCrafter battle-native auto clip engine
- brand sponsorship and promoter tooling
- mobile-first battle experience
- more explicit crew and scene systems

## 19. Final Product Read

Spitzone is already a real product.
It is not a concept and not just a mock battle site.

What exists today is a serious launch kernel with:
- real auth
- real battles
- real queue logic
- real monetization runtime
- real content inventory
- real onboarding and referral loops
- real telemetry and health checks
- real community structure

What it becomes if fully executed is a premium live competitive creator network sitting in the space between:
- TikTok Live-scale creator ambition
- Twitch-style live participation
- Discord-style community identity
- tournament and economy systems that generic live platforms do not natively own

The product does not need to beat TikTok at being TikTok.
It needs to become the highest-signal place for live competitive creative culture, then expand outward from that wedge.

That is the credible path.
