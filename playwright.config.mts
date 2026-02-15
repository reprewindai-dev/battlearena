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
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
