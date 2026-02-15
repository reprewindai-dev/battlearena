const baseUrl = process.env.CLEANUP_URL;
if (!baseUrl) {
  console.error("CLEANUP_URL env var is required (e.g. http://127.0.0.1:3000/api/battle-session/recordings/cleanup-stale?minutes=15)");
  process.exit(1);
}

const intervalMinutesRaw = process.env.CLEANUP_INTERVAL_MINUTES;
const intervalMinutes = intervalMinutesRaw ? Number(intervalMinutesRaw) : null;
const cronSecret = process.env.CRON_CLEANUP_SECRET;

async function runOnce() {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cronSecret ? { "x-cron-secret": cronSecret } : {}),
    },
    body: "{}",
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`cleanup-stale failed: ${res.status} ${res.statusText}`);
    console.error(text);
    process.exitCode = 1;
    return;
  }

  console.log(text);
}

if (!intervalMinutes) {
  await runOnce();
  process.exit(0);
}

const safeMinutes = Number.isFinite(intervalMinutes)
  ? Math.max(1, Math.min(24 * 60, Math.floor(intervalMinutes)))
  : 10;

console.log(`Starting cleanup loop every ${safeMinutes} minutes...`);
await runOnce();
setInterval(() => {
  void runOnce();
}, safeMinutes * 60 * 1000);
