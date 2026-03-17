#!/usr/bin/env node

import { execSync } from "child_process";
import { config } from "dotenv";

config({ path: ".env.production" });
config({ path: ".env.local", override: true });
config({ override: true });

const HEALTH_URL = process.env.LIVEKIT_HEALTH_URL ?? "http://127.0.0.1:7880/";
const START_TIMEOUT_MS = Number(process.env.LIVEKIT_START_TIMEOUT_MS ?? "120000");
const POLL_INTERVAL_MS = 2000;

function run(command) {
  execSync(command, {
    stdio: "inherit",
    env: process.env,
  });
}

async function waitForHealth() {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) return true;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return false;
}

async function main() {
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    throw new Error("missing_livekit_env:LIVEKIT_API_KEY/LIVEKIT_API_SECRET");
  }

  console.log("Starting LiveKit test stack...");
  run("docker compose -f docker-compose.livekit.yml up -d redis turnserver livekit");

  console.log(`Waiting for LiveKit health at ${HEALTH_URL} ...`);
  const healthy = await waitForHealth();
  if (!healthy) {
    throw new Error(`livekit_health_timeout:${HEALTH_URL}`);
  }

  console.log("LiveKit is healthy.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
