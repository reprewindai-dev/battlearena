---
description: Run the full local verification suite
auto_execution_mode: 3
---

1. Install dependencies

   - `npm ci`

2. Run checks

   - `npm run check`

Notes:
- `npm run check` runs lint + typecheck + Playwright tests via the root workspace.
- CI uses the same commands in `.github/workflows/arena-web-ci.yml` and `.github/workflows/arena-web-e2e.yml`.
