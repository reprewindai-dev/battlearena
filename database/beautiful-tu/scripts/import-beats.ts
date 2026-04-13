import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { parseBuffer } from "music-metadata";

const manifestPathArg = process.argv[2];
if (!manifestPathArg) {
  console.error("Usage: ts-node scripts/import-beats.ts <manifest.json>");
  process.exit(1);
}

const manifestPath = path.resolve(manifestPathArg);
if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}`);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.BEATS_STORAGE_BUCKET ?? "beats";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "beat";
}

function inferMoodTags(entry) {
  if (Array.isArray(entry.mood_tags) && entry.mood_tags.length > 0) {
    return entry.mood_tags.slice(0, 8);
  }
  const tags = new Set();
  const genre = String(entry.genre ?? "").toLowerCase();
  const title = String(entry.title ?? "").toLowerCase();
  if (genre) tags.add(genre);
  if (/(trap|drill)/.test(`${genre} ${title}`)) tags.add("aggressive");
  if (/(lofi|soul|r&b|chill)/.test(`${genre} ${title}`)) tags.add("melodic");
  if (!tags.size) tags.add("battle");
  return Array.from(tags);
}

function flags(entry) {
  const bpm = Number(entry.bpm ?? entry.tempo ?? 0);
  const genre = String(entry.genre ?? "").toLowerCase();
  const tournamentSafe = bpm >= 75 && bpm <= 170 && genre !== "ambient";
  return {
    is_featured: Boolean(entry.is_featured ?? tournamentSafe),
    is_homepage_safe: Boolean(entry.is_homepage_safe ?? tournamentSafe),
    is_tournament_safe: Boolean(entry.is_tournament_safe ?? tournamentSafe),
  };
}

function extnameFor(inputPath, fallback = "bin") {
  const ext = path.extname(inputPath).replace(/^\./, "");
  return ext || fallback;
}

function buildArtworkSvg(entry, bpm) {
  const title = String(entry.title ?? "Beat");
  const producer = String(entry.producer_name ?? entry.artist ?? "Unknown Producer");
  const genre = String(entry.genre ?? "battle");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#121221"/><stop offset="55%" stop-color="#f97316"/><stop offset="100%" stop-color="#030712"/></linearGradient></defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect x="88" y="88" width="1024" height="1024" rx="36" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.14)"/>
  <text x="120" y="220" fill="#ffd8b0" font-family="Arial" font-size="40" font-weight="700">BATTLE ARENA</text>
  <text x="120" y="560" fill="#ffffff" font-family="Arial" font-size="88" font-weight="800">${title.replace(/[<&>]/g, "")}</text>
  <text x="120" y="650" fill="#ffe7d2" font-family="Arial" font-size="44" font-weight="600">${producer.replace(/[<&>]/g, "")}</text>
  <text x="120" y="820" fill="#ffffff" font-family="Arial" font-size="32" font-weight="700">${bpm} BPM</text>
  <text x="320" y="820" fill="#ffffff" font-family="Arial" font-size="32" font-weight="700">${genre.replace(/[<&>]/g, "").toUpperCase()}</text>
</svg>`;
}

async function ensureBucket() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  if ((data ?? []).some((item) => item.name === bucket)) return;
  const { error: createError } = await supabase.storage.createBucket(bucket, { public: true });
  if (createError) throw createError;
}

async function loadBuffer(assetPath) {
  if (/^https?:\/\//i.test(assetPath)) {
    const response = await fetch(assetPath);
    if (!response.ok) throw new Error(`download_failed:${response.status}:${assetPath}`);
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? undefined,
    };
  }

  const fullPath = path.resolve(path.dirname(manifestPath), assetPath);
  return {
    buffer: fs.readFileSync(fullPath),
    contentType: undefined,
  };
}

async function uploadPath(storagePath, buffer, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, { contentType, upsert: true });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
}

async function run() {
  await ensureBucket();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const entries = Array.isArray(manifest.beats) ? manifest.beats : [];
  if (!entries.length) throw new Error("Manifest has no beats[] entries");

  let created = 0;
  let updated = 0;
  for (const entry of entries) {
    const baseSlug = slugify(entry.slug ?? `${entry.title}-${entry.producer_name ?? entry.artist ?? "producer"}`);
    const slug = `${baseSlug}-${String(entry.id ?? baseSlug).slice(0, 8)}`.slice(0, 110);
    const producerName = String(entry.producer_name ?? entry.artist ?? "Unknown Producer");
    const bpm = Number(entry.bpm ?? entry.tempo ?? 0);
    if (!entry.title || !producerName || !entry.genre || !bpm || !entry.audio_path) {
      throw new Error(`Invalid manifest entry for slug ${slug}`);
    }

    const audioAsset = await loadBuffer(entry.audio_path);
    const previewAsset = entry.preview_path ? await loadBuffer(entry.preview_path) : audioAsset;
    const artworkSvg = buildArtworkSvg(entry, bpm);
    const audioExt = extnameFor(String(entry.audio_path), "mp3");
    const previewExt = extnameFor(String(entry.preview_path ?? entry.audio_path), "mp3");
    const audioStoragePath = `catalog/audio/${producerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${slug}/main.${audioExt}`;
    const previewStoragePath = `catalog/preview/${producerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${slug}/preview.${previewExt}`;
    const artworkStoragePath = `catalog/artwork/${producerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${slug}/cover.svg`;

    const audioUrl = await uploadPath(audioStoragePath, audioAsset.buffer, audioAsset.contentType ?? "audio/mpeg");
    const previewUrl = await uploadPath(previewStoragePath, previewAsset.buffer, previewAsset.contentType ?? "audio/mpeg");
    const artworkUrl = await uploadPath(artworkStoragePath, Buffer.from(artworkSvg, "utf8"), "image/svg+xml");
    const parsed = await parseBuffer(audioAsset.buffer, audioAsset.contentType ? { mimeType: audioAsset.contentType } : undefined, { duration: true }).catch(() => null);
    const duration = Number(entry.duration ?? entry.duration_seconds ?? Math.round(parsed?.format.duration ?? 0));
    const row = {
      title: String(entry.title),
      slug,
      artist: String(entry.artist ?? producerName),
      producer_name: producerName,
      tempo: bpm,
      bpm,
      key_signature: entry.key ?? entry.musical_key ?? null,
      musical_key: entry.key ?? entry.musical_key ?? null,
      genre: String(entry.genre),
      mood_tags: inferMoodTags(entry),
      duration_seconds: duration > 0 ? duration : null,
      artwork_url: artworkUrl,
      artwork_storage_path: artworkStoragePath,
      file_url: audioUrl,
      preview_url: previewUrl,
      audio_storage_path: audioStoragePath,
      preview_storage_path: previewStoragePath,
      waveform_status: "placeholder_generated",
      is_active: true,
      is_verified: true,
      status: "active",
      license_type: String(entry.license_type ?? "provided_pack"),
      source: String(entry.source ?? "manifest_import"),
      ...flags(entry),
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase.from("beats").select("id").eq("slug", slug).maybeSingle();
    const query = existing
      ? supabase.from("beats").update(row).eq("id", existing.id)
      : supabase.from("beats").insert(row);
    const { error } = await query;
    if (error) throw error;
    if (existing) updated += 1; else created += 1;
    console.log(`${existing ? "updated" : "created"}: ${slug}`);
  }

  console.log(JSON.stringify({ ok: true, created, updated, total: entries.length }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
