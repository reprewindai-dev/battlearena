# MORNING REPORT — Arena Web (apps/web)

## What shipped

- Next.js App Router app at `apps/web` with Tailwind + shadcn/ui styling and a cinematic dark UI baseline.
- Guest + authenticated routing split:
  - Guest: landing, login, signup
  - App shell: `/app/*` routes behind auth
- Auth/session model:
  - Supabase-ready (browser + server client helpers)
  - Local dev mock auth when Supabase env vars are missing
  - Cookies:
    - `arena_mock_session` (mock session flag)
    - `arena_role` (`user` | `mod` | `admin`)
- RBAC enforcement:
  - Middleware protects `/app/*`
  - Admin route gated via server-side role check
- Feature skeleton pages:
  - `/app/profile`
  - `/app/battles`
  - `/app/battles/room`
  - `/app/moderation`
  - `/app/admin`
- Playwright smoke tests:
  - Auth page renders
  - Protected route redirect when logged out
  - RBAC admin block for non-admin
  - Battle room skeleton loads

## What’s fixed (stability)

- TypeScript “Cannot find type definition file …” issues addressed by explicitly setting `types` + `typeRoots` in each app `tsconfig.json` (monorepo hoisted deps).
- Playwright config now runs reliably on Windows:
  - Uses `127.0.0.1` base URL to avoid localhost oddities
  - Uses an ESM config file: `apps/web/playwright.config.mts`

## How to run (local)

From repo root:

```powershell
npm install
npm run dev
```

Open:

- `http://127.0.0.1:3000`

## How to run tests

```powershell
npm test
```

## Environment

- Copy `.env.example` -> `.env` (repo root) OR create `apps/web/.env.local`.

Supabase (optional for real auth):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

If those are missing, the app uses mock auth and sets cookies via `POST /api/mock-login`.

## Next up

- Supabase migrations follow-up pass:
  - Validate RLS policies against real Supabase Auth JWT claims
  - Add any missing indexes, constraints, and RPC wiring
- Dev experience:
  - Expand root docs for full monorepo conventions (workspaces, scripts, CI)
- Feature implementation beyond skeletons:
  - Battle lifecycle, recording, chat, judging
  - Moderation workflows and audit log UI
