#!/usr/bin/env node

import { spawnSync } from "child_process";

const nodeExec = process.execPath;

function ensureLiveKitTestEnv() {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;

  if (!key || key === "your_livekit_api_key") {
    process.env.LIVEKIT_API_KEY = "battlearena_e2e_livekit_key";
  }
  if (!secret || secret.length < 32 || secret === "your_livekit_api_secret") {
    process.env.LIVEKIT_API_SECRET = "battlearena_e2e_livekit_secret_32";
  }
  if (!process.env.NEXT_PUBLIC_LIVEKIT_URL) {
    process.env.NEXT_PUBLIC_LIVEKIT_URL = "ws://127.0.0.1:7880";
  }
  if (!process.env.LIVEKIT_HEALTH_URL) {
    process.env.LIVEKIT_HEALTH_URL = "http://127.0.0.1:7880/";
  }
}

function run(command, args) {
  return spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
}

function runNpm(args) {
  return spawnSync("npm", args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
}

function status(result) {
  return typeof result.status === "number" ? result.status : 1;
}

let code = 0;
ensureLiveKitTestEnv();

const up = run(nodeExec, ["scripts/test-livekit.mjs"]);
if (up.status !== 0) process.exit(status(up));

const testRun = runNpm(["run", "test:e2e:raw", "--", "e2e/live-video.spec.ts"]);
code = status(testRun);

const down = run(nodeExec, ["scripts/stop-livekit.mjs"]);
if (down.status !== 0 && code === 0) {
  code = status(down);
}

process.exit(code);
