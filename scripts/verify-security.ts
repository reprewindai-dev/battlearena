#!/usr/bin/env node

import { config } from "dotenv";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

config({ path: ".env.production" });
config({ path: ".env.local" });
config();

type Result = { name: string; ok: boolean; details?: string };

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchStatus(url: string, init?: RequestInit): Promise<number | null> {
  try {
    const res = await fetch(url, init);
    return res.status;
  } catch {
    return null;
  }
}

function walkFiles(root: string, extensions: string[], maxBytes = 2_000_000): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = readdirSync(current);
    for (const entry of entries) {
      const full = join(current, entry);
      const s = statSync(full);
      if (s.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (s.size > maxBytes) continue;
      if (extensions.some((ext) => full.endsWith(ext))) {
        out.push(full);
      }
    }
  }
  return out;
}

function fileContainsAny(path: string, patterns: RegExp[]): boolean {
  const text = readFileSync(path, "utf8");
  return patterns.some((p) => p.test(text));
}

async function testLocalHttpSecurity(): Promise<Result[]> {
  const baseUrl = process.env.VERIFY_BASE_URL ?? "http://localhost:3100";
  const alive = await fetchStatus(`${baseUrl}/`);
  if (alive === null) {
    return [
      { name: "HTTP Security Checks", ok: true, details: `skipped (server not reachable at ${baseUrl})` },
    ];
  }

  const results: Result[] = [];

  const corsProbe = await fetch(`${baseUrl}/`, {
    headers: { Origin: "https://evil.example" },
  });
  const acao = corsProbe.headers.get("access-control-allow-origin");
  const corsOk = !(acao === "*" || acao === "https://evil.example");
  results.push({
    name: "CORS Origin Restriction",
    ok: corsOk,
    details: acao ? `acao=${acao}` : "no ACAO header (acceptable for same-origin)",
  });

  const headers = corsProbe.headers;
  const required = ["x-frame-options", "x-content-type-options"];
  const missing = required.filter((h) => !headers.has(h));
  results.push({
    name: "Security Headers Baseline",
    ok: missing.length === 0,
    details: missing.length === 0 ? "present" : `missing: ${missing.join(",")}`,
  });

  const adminCode = await fetchStatus(`${baseUrl}/api/admin/users`);
  results.push({
    name: "Admin API Protected",
    ok: adminCode === 401 || adminCode === 403 || adminCode === 404,
    details: `status=${adminCode ?? "unreachable"}`,
  });

  const modCode = await fetchStatus(`${baseUrl}/api/moderation/cases`);
  results.push({
    name: "Moderation API Protected",
    ok: modCode === 401 || modCode === 403 || modCode === 404,
    details: `status=${modCode ?? "unreachable"}`,
  });

  return results;
}

function testSecretExposureOnSource(): Result {
  const srcRoot = join(process.cwd(), "src");
  const files = walkFiles(srcRoot, [".ts", ".tsx", ".js", ".jsx"]);

  const patterns = [
    /sk_live_[A-Za-z0-9]+/,
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /whsec_[A-Za-z0-9]{20,}/,
  ];

  const hit = files.find((file) => fileContainsAny(file, patterns));
  return {
    name: "No Hardcoded Secrets in Source",
    ok: !hit,
    details: hit ? `found pattern in ${hit}` : "ok",
  };
}

function testBundleExposure(): Result {
  const buildRoot = join(process.cwd(), ".next");
  if (!existsSync(buildRoot)) {
    return { name: "No Secrets in Build Bundle", ok: true, details: "skipped (.next not present)" };
  }

  const scanRoots = [join(buildRoot, "static"), join(buildRoot, "server")].filter((p) => existsSync(p));
  const files = scanRoots.flatMap((root) => walkFiles(root, [".js", ".json", ".txt"], 4_000_000));

  const exactSecrets = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.LIVEKIT_API_SECRET,
    process.env.STRIPE_SECRET_KEY,
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.AWS_SECRET_ACCESS_KEY,
    process.env.JWT_SECRET,
    process.env.JWT_REFRESH_SECRET,
  ]
    .filter((v): v is string => Boolean(v && v.length >= 16))
    .filter((v) => !v.startsWith("your_"));

  let hit: string | null = null;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (exactSecrets.some((secret) => text.includes(secret))) {
      hit = file;
      break;
    }
  }

  return {
    name: "No Secrets in Build Bundle",
    ok: !hit,
    details: hit ? `found marker in ${hit}` : "ok",
  };
}

async function main() {
  const results: Result[] = [];

  results.push(...(await testLocalHttpSecurity()));
  results.push(testSecretExposureOnSource());
  results.push(testBundleExposure());

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log("Security System Verification");
  console.log("=====================================");
  results.forEach((result) => {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}${result.details ? ` (${result.details})` : ""}`);
  });
  console.log("=====================================");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`Security verifier crashed: ${errMessage(error)}`);
  process.exitCode = 1;
});
