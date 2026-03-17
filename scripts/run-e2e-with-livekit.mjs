#!/usr/bin/env node

import { spawnSync } from "child_process";

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

function runNodeScript(scriptPath) {
  return spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: process.env,
  });
}

function runNpm(args) {
  const npmCmd = "npm";
  return spawnSync(npmCmd, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
}

function exitCode(result) {
  if (typeof result.status === "number") return result.status;
  return 1;
}

let code = 0;
ensureLiveKitTestEnv();

const up = runNodeScript("scripts/test-livekit.mjs");
if (up.status !== 0) {
  process.exit(exitCode(up));
}

const testArgs = process.argv.slice(2);
const run = runNpm(["run", "test:e2e:raw", ...(testArgs.length > 0 ? ["--", ...testArgs] : [])]);
code = exitCode(run);

const down = runNodeScript("scripts/stop-livekit.mjs");
if (down.status !== 0 && code === 0) {
  code = exitCode(down);
}

process.exit(code);
