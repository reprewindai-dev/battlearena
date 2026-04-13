#!/usr/bin/env node

import { execSync } from "child_process";

try {
  execSync("docker compose -f docker-compose.livekit.yml down", {
    stdio: "inherit",
    env: process.env,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
