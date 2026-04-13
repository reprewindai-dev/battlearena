/* eslint-env node */
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(configDir, ".env.production") });
config({ path: path.join(configDir, ".env.local") });
config({ path: path.join(configDir, ".env") });

const port = process.env.PORT ?? "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const disableWebServer = process.env.PLAYWRIGHT_DISABLE_WEBSERVER === "true";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
    permissions: ["camera", "microphone"],
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
      },
    },
  ],
  webServer: disableWebServer
    ? undefined
    : {
        command: `npm run dev -- --port ${port}`,
        cwd: configDir,
        url: baseURL,
        env: {
          ...process.env,
          SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        reuseExistingServer: false,
        timeout: 240_000,
      },
});
