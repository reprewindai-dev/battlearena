// Ingest BeatStars-quality CC0 beats from Pixabay into Supabase beats table/storage
// Requirements: set env SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PIXABAY_API_KEY
// Optional: BUCKET_BEATS (default: beats), INGEST_USER_EMAIL (default: beats-ingest@system.local)
// Run: node scripts/ingest-pixabay-beats.mjs

import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PIXABAY_API_KEY,
  BUCKET_BEATS = "beats",
  INGEST_USER_EMAIL = "beats-ingest@system.local",
  INGEST_USER_ID,
  INGEST_USER_PASSWORD,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PIXABAY_API_KEY) {
  console.error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PIXABAY_API_KEY are required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PIXABAY_ENDPOINT = "https://pixabay.com/api/";
const LICENSE_URL = "https://pixabay.com/service/license-summary/";
const MAX_TRACKS = 40;
const QUERIES = ["hip hop", "trap", "rap", "lofi"];
const FALLBACK_TRACKS = [
  {
    id: "pixabay-future-bass-21564",
    title: "Future Bass Beat",
    artist: "Pixabay Artist",
    genre: "hip-hop",
    duration: 0,
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_1c9b4f0c08.mp3?filename=future-bass-beat-21564.mp3",
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_1c9b4f0c08.mp3?filename=future-bass-beat-21564.mp3",
  },
  {
    id: "pixabay-hip-hop-9276",
    title: "Hip Hop",
    artist: "Pixabay Artist",
    genre: "hip-hop",
    duration: 0,
    downloadUrl: "https://cdn.pixabay.com/download/audio/2021/10/30/audio_1f4f66772b.mp3?filename=hip-hop-9276.mp3",
    previewUrl: "https://cdn.pixabay.com/download/audio/2021/10/30/audio_1f4f66772b.mp3?filename=hip-hop-9276.mp3",
  },
  {
    id: "pixabay-hard-trap-14250",
    title: "Hard Trap",
    artist: "Pixabay Artist",
    genre: "trap",
    duration: 0,
    downloadUrl: "https://cdn.pixabay.com/download/audio/2022/01/12/audio_7ef5bcdd85.mp3?filename=hard-trap-14250.mp3",
    previewUrl: "https://cdn.pixabay.com/download/audio/2022/01/12/audio_7ef5bcdd85.mp3?filename=hard-trap-14250.mp3",
  },
  {
    id: "pixabay-lofi-study-112191",
    title: "Lofi Study",
    artist: "Pixabay Artist",
    genre: "lofi",
    duration: 0,
    downloadUrl: "https://cdn.pixabay.com/download/audio/2023/02/09/audio_0e27c4d1c0.mp3?filename=lofi-study-112191.mp3",
    previewUrl: "https://cdn.pixabay.com/download/audio/2023/02/09/audio_0e27c4d1c0.mp3?filename=lofi-study-112191.mp3",
  },
];

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const exists = buckets?.some((b) => b.name === BUCKET_BEATS);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_BEATS, {
      public: true,
    });
    if (createError) throw createError;
  }
}

async function getIngestUserId() {
  if (INGEST_USER_ID) return INGEST_USER_ID;

  // Try listUsers via admin API and match email
  const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    throw new Error(`auth admin listUsers failed: ${listErr.message}`);
  }
  const found = listed?.users?.find((u) => u.email === INGEST_USER_EMAIL);
  if (found?.id) return found.id;

  // If any user exists, fallback to the first one
  if (listed?.users?.length) {
    return listed.users[0].id;
  }

  // Create via admin API
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: INGEST_USER_EMAIL,
    email_confirm: true,
    password: INGEST_USER_PASSWORD,
    user_metadata: { system: true, role: "ingest" },
    app_metadata: { role: "ingest" },
  });
  if (createErr || !created?.user?.id) {
    console.warn(
      `Ingest user not found and create failed (${INGEST_USER_EMAIL}): ${listErr?.message ?? createErr?.message}`
    );
    return null;
  }
  return created.user.id;
}

async function fetchPixabay(query) {
  const url = new URL(PIXABAY_ENDPOINT);
  url.searchParams.set("key", PIXABAY_API_KEY);
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", "50");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("order", "popular");
  url.searchParams.set("media_type", "music");
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pixabay fetch failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json?.hits ?? [];
}

function normalizeTrack(hit) {
  const downloadUrl = hit?.audio || hit?.downloadURL || hit?.audioURL || hit?.url || hit?.link;
  const previewUrl = hit?.previewURL || hit?.preview;
  if (!downloadUrl || !previewUrl) return null;
  const titleBase = hit?.tags?.split(",")[0]?.trim() || `pixabay-${hit.id}`;
  return {
    id: hit.id,
    title: titleBase,
    artist: hit.user || "Pixabay Creator",
    duration: hit.duration || null,
    tags: hit.tags || "",
    genre: inferGenre(hit.tags),
    downloadUrl,
    previewUrl,
  };
}

function inferGenre(tags = "") {
  const t = tags.toLowerCase();
  if (t.includes("trap")) return "trap";
  if (t.includes("hip hop") || t.includes("hip-hop") || t.includes("rap")) return "hip-hop";
  if (t.includes("lofi") || t.includes("chill")) return "lofi";
  return "hip-hop";
}

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadTrack(path, buffer, contentType = "audio/mpeg") {
  const { data, error } = await supabase.storage
    .from(BUCKET_BEATS)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw error;
  return data?.path;
}

function publicUrl(path) {
  const { data } = supabase.storage.from(BUCKET_BEATS).getPublicUrl(path);
  return data.publicUrl;
}

async function insertBeat({ track, storagePath, fileUrl, ingestUserId }) {
  const { error } = await supabase.from("beats").upsert(
    {
      title: track.title,
      artist: track.artist,
      tempo: null,
      key_signature: null,
      genre: track.genre,
      duration_seconds: track.duration || 0,
      file_url: fileUrl,
      preview_url: track.previewUrl,
      license_type: "CC0",
      license_url: LICENSE_URL,
      source: "pixabay",
      uploaded_by: ingestUserId || null,
      is_verified: true,
      is_active: true,
      status: "active",
    },
    { onConflict: "file_url" }
  );
  if (error) throw error;
  return storagePath;
}

async function run() {
  await ensureBucket();
  const ingestUserId = await getIngestUserId();

  const collected = [];
  for (const query of QUERIES) {
    const hits = await fetchPixabay(query);
    for (const hit of hits) {
      const track = normalizeTrack(hit);
      if (!track) continue;
      const exists = collected.find((t) => t.previewUrl === track.previewUrl || t.downloadUrl === track.downloadUrl);
      if (!exists) collected.push(track);
      if (collected.length >= MAX_TRACKS) break;
    }
    if (collected.length >= MAX_TRACKS) break;
  }

  if (collected.length === 0) {
    console.warn("Pixabay returned no tracks or was blocked; using fallback CC0 tracks.");
    for (const fb of FALLBACK_TRACKS) {
      collected.push({
        id: fb.id,
        title: fb.title,
        artist: fb.artist,
        duration: fb.duration,
        tags: "fallback,cc0",
        genre: fb.genre,
        downloadUrl: fb.downloadUrl,
        previewUrl: fb.previewUrl,
      });
    }
  }

  console.log(`Collected ${collected.length} tracks`);

  let success = 0;
  for (const track of collected) {
    try {
      const buffer = await downloadBuffer(track.downloadUrl);
      const ext = track.downloadUrl.split(".").pop()?.split("?")[0] || "mp3";
      const storagePath = `pixabay/${track.id}.${ext}`;
      await uploadTrack(storagePath, buffer);
      const fileUrl = publicUrl(storagePath);
      await insertBeat({ track, storagePath, fileUrl, ingestUserId });
      success += 1;
      console.log(`Ingested ${track.title} -> ${storagePath}`);
    } catch (err) {
      console.error(`Failed ingest for ${track?.id}:`, err.message);
    }
  }

  console.log(`Done. Success: ${success}/${collected.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
