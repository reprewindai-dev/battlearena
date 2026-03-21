import fs from "fs";
import path from "path";

import { parseBuffer } from "music-metadata";

const searchRoot = path.resolve(process.argv[2] ?? "tmp/local_beats");
const appBaseUrl = (process.argv[3] ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://battlearena-poon.onrender.com").replace(/\/$/, "");

if (!fs.existsSync(searchRoot)) {
  console.error(`Beat root not found: ${searchRoot}`);
  process.exit(1);
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

async function collectAudioFiles(root: string) {
  const queue = [root];
  const rows: Array<{ normalizedKey: string; durationSeconds: number }> = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (!/\.(mp3|wav|flac|m4a|aac)$/i.test(entry.name)) {
        continue;
      }

      const buffer = fs.readFileSync(fullPath);
      const metadata = await parseBuffer(buffer, undefined, { duration: true }).catch(() => null);
      const durationSeconds = Math.round(metadata?.format.duration ?? 0);
      if (durationSeconds <= 0) {
        continue;
      }

      rows.push({
        normalizedKey: normalizeKey(path.basename(entry.name)),
        durationSeconds,
      });
    }
  }

  const unique = new Map<string, number>();
  for (const row of rows) {
    if (!unique.has(row.normalizedKey)) {
      unique.set(row.normalizedKey, row.durationSeconds);
    }
  }

  return Array.from(unique.entries()).map(([normalizedKey, durationSeconds]) => ({
    normalizedKey,
    durationSeconds,
  }));
}

async function main() {
  const rows = await collectAudioFiles(searchRoot);
  if (rows.length === 0) {
    console.error("No local audio files with parsed duration were found.");
    process.exit(1);
  }

  const values = rows
    .map((row) => `    ('${escapeSql(row.normalizedKey)}', ${row.durationSeconds})`)
    .join(",\n");

  const sql = `with local_files(normalized_key, duration_seconds) as (\n${values}\n)\nupdate public.beats as beats\nset\n  duration_seconds = local_files.duration_seconds,\n  artwork_url = coalesce(nullif(beats.artwork_url, ''), '${escapeSql(appBaseUrl)}/api/beats/artwork/' || beats.slug),\n  waveform_status = 'placeholder_generated',\n  is_featured = case\n    when coalesce(beats.bpm, beats.tempo, 0) between 75 and 170\n      and lower(coalesce(beats.genre, '')) <> 'ambient'\n      and lower(coalesce(beats.genre, '')) in ('hip-hop', 'trap', 'drill', 'boom-bap', 'lofi', 'lo-fi')\n    then true else coalesce(beats.is_featured, false) end,\n  is_homepage_safe = case\n    when coalesce(beats.bpm, beats.tempo, 0) between 75 and 170\n      and lower(coalesce(beats.genre, '')) <> 'ambient'\n    then true else coalesce(beats.is_homepage_safe, false) end,\n  is_tournament_safe = case\n    when coalesce(beats.bpm, beats.tempo, 0) between 75 and 170\n      and lower(coalesce(beats.genre, '')) <> 'ambient'\n    then true else false end,\n  updated_at = now()\nfrom local_files\nwhere regexp_replace(lower(regexp_replace(coalesce(beats.audio_storage_path, ''), '^.*/', '')), '[^a-z0-9]+', '', 'g') = local_files.normalized_key\n  and coalesce(beats.duration_seconds, 0) <= 0;\n\nselect count(*) as normalized_rows\nfrom public.beats\nwhere is_active = true\n  and is_verified = true\n  and status = 'active'\n  and duration_seconds > 0\n  and artwork_url is not null\n  and file_url is not null\n  and preview_url is not null;`;

  process.stdout.write(sql);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
