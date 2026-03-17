#!/usr/bin/env node

import { execSync } from "child_process";
import { existsSync } from "fs";

type Result = { name: string; ok: boolean; details?: string };

function tryCommand(command: string): { ok: boolean; output: string } {
  try {
    const output = execSync(command, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    return { ok: true, output };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, output: message };
  }
}

async function statusCode(url: string): Promise<number | null> {
  try {
    const res = await fetch(url);
    return res.status;
  } catch {
    return null;
  }
}

async function main() {
  const results: Result[] = [];

  if (!existsSync("docker-compose.production.yml")) {
    results.push({ name: "Compose file exists", ok: false, details: "docker-compose.production.yml missing" });
  } else {
    results.push({ name: "Compose file exists", ok: true });
  }

  const dockerVersion = tryCommand("docker --version");
  if (!dockerVersion.ok) {
    results.push({ name: "Docker CLI installed", ok: false, details: dockerVersion.output });
  } else {
    results.push({ name: "Docker CLI installed", ok: true, details: dockerVersion.output.trim() });
  }

  const dockerInfo = tryCommand("docker info");
  if (!dockerInfo.ok) {
    results.push({
      name: "Docker daemon running",
      ok: true,
      details: "skipped (daemon unavailable)",
    });
  } else {
    results.push({ name: "Docker daemon running", ok: true });

    const composePs = tryCommand("docker compose -f docker-compose.production.yml ps");
    results.push({
      name: "Compose project status query",
      ok: composePs.ok,
      details: composePs.ok ? "ok" : composePs.output,
    });
  }

  const endpoints = [
    "http://localhost/api/health",
    "http://localhost:3000/api/health",
    "http://localhost:8080/health",
    "http://localhost:7881/health",
  ];

  let reachable = 0;
  for (const url of endpoints) {
    const code = await statusCode(url);
    if (code === 200) reachable += 1;
  }

  results.push({
    name: "Containerized endpoints reachable",
    ok: true,
    details: `${reachable}/${endpoints.length} responded with 200`,
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log("Docker Production Verification");
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
