# Arena v2 / Spitzone — Replit Project

## Overview
A live music battle platform where users compete in real-time audio battles, earn reputation, and participate in a community-governed economy.

## Stack
- **Framework**: Next.js 16.1.6 (App Router, Turbopack)
- **Auth + DB**: Supabase (PostgreSQL, RLS, Auth)
- **Payments**: Stripe (token purchases, webhook)
- **Real-time Audio**: LiveKit (WebRTC battles)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **State**: Zustand + TanStack React Query

## Running the App
```
npm run dev   # starts on port 5000
npm run build # production build
npm run start # production start (port 5000)
```

## Required Secrets (add in Replit Secrets tab)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

## Database Migrations
Run SQL files in `migrations/` against your Supabase database in order:
1. `002_ghost_recording_system.sql` — ghost recordings, governance, telemetry tables
2. `003_tournament_brackets_economy_governance.sql` — brackets, wallet, Glicko-2 history, governance proposals

## Architecture

### Key Source Directories
- `src/app/api/` — all API routes (Next.js Route Handlers)
- `src/app/app/` — authenticated app pages
- `src/app/(guest)/` — public pages (login, signup)
- `src/components/` — UI components
- `src/lib/` — server-side utilities and services

### Core Systems Implemented
1. **Battle Engine** — Live PvP + bot battles via LiveKit, governed opponent AI, ghost recordings
2. **Tournament System** — Create, register, bracket generation (single/double elim, round robin), match advancement, prize distribution
3. **Dual Currency Economy** — Crowns (reputation, earned) + Tokens (purchasable via Stripe), wallet UI, transaction history
4. **Glicko-2 Rating System** — Applied after each battle, rating history tracked, tier progression UI
5. **Community Governance** — Proposals, voting (for/against/abstain), quorum tracking, category filtering
6. **Leaderboard** — Live rankings with tier filter and period filter
7. **Admin Dashboard** — Governance monitoring, telemetry, user management, beat ingestion
8. **Moderation** — Case management, AI-assisted, human review
9. **Community** — Crews, mentorships, events, activity feed, challenges

### Economy Model
- **Crowns**: Reputation currency. Earned by winning battles (10/win), tournaments (50/1st, 25/2nd, 10/semi). Not purchasable.
- **Tokens**: Purchasable via Stripe. Used for tournament entry fees. Earned as participation bonus (2/battle).

### Rating System
- Uses Glicko-2 algorithm (src/lib/ratings/glicko2.ts)
- Applied non-blockingly after each battle finalize
- Tier thresholds: Bronze (0), Silver (1200), Gold (1400), Platinum (1600), Diamond (1800), Legend (2000+)

## Page Routes
- `/app` — Home dashboard
- `/app/battles` — Battle lobby
- `/app/tournaments` — Tournament list + creation
- `/app/tournaments/[id]` — Tournament detail + bracket viewer
- `/app/leaderboard` — Global rankings
- `/app/community` — Community hub (crews, events, feed)
- `/app/governance` — Community governance proposals + voting
- `/app/economy` — Wallet (Crowns + Tokens + transaction history)
- `/app/shop` — Buy token packs
- `/app/profile` — Own profile
- `/app/admin` — Admin panel (admin role only)
- `/app/moderation` — Moderation queue (admin/mod role only)
