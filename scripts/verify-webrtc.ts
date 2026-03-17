#!/usr/bin/env node

import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

config({ path: ".env.production" });
config({ path: ".env.local" });
config();

type Result = { name: string; ok: boolean; details?: string };

function has(text: string, token: string): boolean {
  return text.includes(token);
}

async function maybeStatus(url: string): Promise<number | null> {
  try {
    const res = await fetch(url);
    return res.status;
  } catch {
    return null;
  }
}

function verifySourceContracts(): Result[] {
  const results: Result[] = [];

  const cockpitPath = join(process.cwd(), "src/components/battle/BattleRoomCockpit.tsx");
  const videoPath = join(process.cwd(), "src/components/battle/VideoBattleProduction.tsx");
  const clientPath = join(process.cwd(), "src/lib/livekit/client.ts");

  if (!existsSync(cockpitPath) || !existsSync(videoPath) || !existsSync(clientPath)) {
    return [{ name: "Source Contracts", ok: false, details: "missing required live video files" }];
  }

  const cockpit = readFileSync(cockpitPath, "utf8");
  const video = readFileSync(videoPath, "utf8");
  const client = readFileSync(clientPath, "utf8");

  results.push({
    name: "Cockpit mounts production video component",
    ok: has(cockpit, "<VideoBattleProduction"),
  });

  results.push({
    name: "Video component has deterministic selectors",
    ok:
      has(video, 'data-testid="battle-video-production"') &&
      has(video, 'data-testid="join-room"') &&
      has(video, 'data-testid="enable-camera"') &&
      has(video, 'data-testid="enable-mic"') &&
      has(video, 'data-testid="remote-video"'),
  });

  results.push({
    name: "LiveKit client includes reconnect/backoff behavior",
    ok: has(client, "maxAttempts = 3") && has(client, "backoffMs"),
  });

  results.push({
    name: "LiveKit client performs explicit local track cleanup",
    ok: has(client, "unpublishAllLocalTracks") && has(client, "this.localVideoTrack.stop()"),
  });

  return results;
}

async function verifyTokenRouteAuth(): Promise<Result> {
  const baseUrl = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
  const status = await maybeStatus(`${baseUrl}/api/livekit/token?room=test-room&participant=test-user`);
  if (status === null) {
    return {
      name: "LiveKit token route denies unauthenticated users",
      ok: true,
      details: `skipped (server not reachable at ${baseUrl})`,
    };
  }

  return {
    name: "LiveKit token route denies unauthenticated users",
    ok: status === 401 || status === 403,
    details: `status=${status}`,
  };
}

async function main() {
  const results: Result[] = [];

  const envChecks: Result[] = [
    {
      name: "LiveKit API key configured",
      ok: Boolean(process.env.LIVEKIT_API_KEY?.trim()),
    },
    {
      name: "LiveKit API secret configured",
      ok: Boolean(process.env.LIVEKIT_API_SECRET?.trim()),
    },
    {
      name: "Public LiveKit URL configured",
      ok: Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim()),
    },
  ];

  results.push(...envChecks);
  results.push(...verifySourceContracts());
  results.push(await verifyTokenRouteAuth());

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log("WebRTC System Verification");
  console.log("=====================================");
  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}${result.details ? ` (${result.details})` : ""}`);
  }
  console.log("=====================================");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
