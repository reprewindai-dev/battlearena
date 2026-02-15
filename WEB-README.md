# Arena Web (`apps/web`)

Next.js (App Router) web client for ARENA.

## Quick start (PowerShell)

From anywhere:

```powershell
cd "C:\Users\antho\CascadeProjects\windsurf-project-3\apps\web"
npm install
npm run dev
```

Then open:

- `http://127.0.0.1:3000`

## Environment

This app supports two modes:

- **Mock auth (default for local dev):** if Supabase env vars are missing, the app uses cookie-based mock auth.
- **Supabase auth (real):** set the Supabase env vars below.

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Supabase setup (minimal)

1. Create a new Supabase project.
2. In Supabase Dashboard:
   - SQL Editor: run the migrations in `supabase/migrations/` (in order).
3. In Project Settings -> API:
   - Copy `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon public` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Roles (JWT claims)

RLS is designed to work with roles coming from JWT claims:

- `user.app_metadata.role` (preferred)
- `user.user_metadata.role` (fallback)

The app currently reads those claims server-side when Supabase is configured, but still supports mock cookies for local dev.

Notes:

- When Supabase vars are not set, logging in will hit `POST /api/mock-login` and set cookies.
- Role is controlled by the `arena_role` cookie (`user`, `mod`, `admin`).

To force mock auth even when Supabase keys exist, set:

```env
ARENA_FORCE_MOCK_AUTH=1
```

## Key routes

- `/` landing
- `/login` / `/signup` guest auth
- `/app` authenticated home
- `/app/profile` profile
- `/app/battles` battle lobby skeleton
- `/app/battles/room` battle room skeleton
- `/app/moderation` moderation console skeleton (RBAC)
- `/app/admin` admin placeholder (RBAC)

## Tests (Playwright)

Run the smoke suite:

```powershell
cd "C:\Users\antho\CascadeProjects\windsurf-project-3\apps\web"
npm test
```

Or explicitly:

```powershell
npm run test:e2e
```

## Common issues

### Playwright uses `127.0.0.1` (not `localhost`)

On Windows, `localhost` vs `127.0.0.1` can cause dev-server / test flakiness. Playwright is configured with:

- `PLAYWRIGHT_BASE_URL` default: `http://127.0.0.1:3000`

### TypeScript missing types

This monorepo hoists dependencies to the repo root. `tsconfig.json` is configured with `typeRoots` so the app can resolve `@types/*` from the root `node_modules`.
