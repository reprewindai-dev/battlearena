import { parseBuffer } from "music-metadata";

export type BeatSurfaceFlags = {
  is_featured: boolean;
  is_homepage_safe: boolean;
  is_tournament_safe: boolean;
};

export function slugifyBeat(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "beat";
}

export function inferMoodTags(input: { genre?: string | null; title?: string | null }) {
  const values = new Set<string>();
  const lowerGenre = input.genre?.toLowerCase() ?? "";
  const lowerTitle = input.title?.toLowerCase() ?? "";

  if (lowerGenre) values.add(lowerGenre);
  if (/(trap|drill)/.test(lowerGenre + " " + lowerTitle)) values.add("aggressive");
  if (/(lofi|soul|r&b|chill)/.test(lowerGenre + " " + lowerTitle)) values.add("melodic");
  if (/(club|party|anthem|fyah|run em up)/.test(lowerTitle)) values.add("hype");
  if (/(dark|menace|deal|rockstar)/.test(lowerTitle)) values.add("dark");
  if (values.size === 0) values.add("battle");

  return Array.from(values).slice(0, 8);
}

export function inferBeatFlags(input: { bpm?: number | null; genre?: string | null; usage_count?: number | null }): BeatSurfaceFlags {
  const bpm = input.bpm ?? 0;
  const genre = input.genre?.toLowerCase() ?? "";
  const usage = input.usage_count ?? 0;
  const tournamentSafe = bpm >= 75 && bpm <= 170 && genre !== "ambient";
  const homepageSafe = tournamentSafe && usage >= 0;
  const featured = homepageSafe && (usage >= 0 || ["hip-hop", "trap", "drill", "boom-bap", "lofi"].includes(genre));

  return {
    is_featured: featured,
    is_homepage_safe: homepageSafe,
    is_tournament_safe: tournamentSafe,
  };
}

export function parseStoragePathFromPublicUrl(value?: string | null) {
  if (!value) return null;
  const match = value.match(/\/object\/public\/[^/]+\/(.+)$/);
  return match?.[1] ?? null;
}

export function buildFallbackArtworkSvg(input: { title: string; producerName: string; bpm: number; genre: string | null }) {
  const title = escapeXml(input.title);
  const producer = escapeXml(input.producerName);
  const genre = escapeXml(input.genre ?? "battle");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1f0f2e"/>
      <stop offset="50%" stop-color="#ff6a00"/>
      <stop offset="100%" stop-color="#0b0a14"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <circle cx="920" cy="220" r="180" fill="rgba(255,255,255,0.08)"/>
  <circle cx="220" cy="980" r="220" fill="rgba(255,255,255,0.06)"/>
  <rect x="96" y="96" width="1008" height="1008" rx="36" fill="rgba(0,0,0,0.24)" stroke="rgba(255,255,255,0.15)"/>
  <text x="120" y="210" fill="#ffe7d2" font-family="Arial, sans-serif" font-size="40" font-weight="700" letter-spacing="6">SPITZONE</text>
  <text x="120" y="560" fill="#ffffff" font-family="Arial, sans-serif" font-size="96" font-weight="800">${title}</text>
  <text x="120" y="660" fill="#ffd4a8" font-family="Arial, sans-serif" font-size="48" font-weight="600">${producer}</text>
  <text x="120" y="840" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="700">${input.bpm} BPM</text>
  <text x="320" y="840" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="700">${genre.toUpperCase()}</text>
</svg>`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function parseAudioDurationSeconds(buffer: Buffer, mimeType?: string | null) {
  const metadata = await parseBuffer(buffer, mimeType ? { mimeType } : undefined, {
    duration: true,
  });

  const duration = metadata.format.duration ?? 0;
  return duration > 0 ? Math.round(duration) : 0;
}
