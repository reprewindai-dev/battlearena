/* eslint-env node */
import { defineConfig, devices } from "@playwright/test";

import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3000",
    cwd: configDir,
    url: baseURL,
    env: {
      ...process.env,
      ARENA_FORCE_MOCK_AUTH: "1",
      NEXT_PUBLIC_ARENA_FORCE_MOCK_AUTH: "1",
      MOCK_AUTH: "true",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock.mock.mock.mock.mock",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
