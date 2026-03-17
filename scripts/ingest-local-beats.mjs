// Ingest local beat files from tmp/local_beats into Supabase storage and beats table
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUCKET_BEATS (default beats)
// Run: node scripts/ingest-local-beats.mjs

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  BUCKET_BEATS = "beats",
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const LOCAL_ROOT = path.resolve("tmp/local_beats");
const LICENSE_TYPE = "provided_pack";
const SOURCE = "local_pack";

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const exists = buckets?.some((b) => b.name === BUCKET_BEATS);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET_BEATS, { public: true });
    if (createError) throw createError;
  }
}

function walkFiles(root) {
  const files = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(p));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if ([".mp3", ".wav", ".flac", ".aac", ".m4a"].includes(ext)) {
        files.push(p);
      }
    }
  }
  return files;
}

function extractProducer(filePath) {
  const name = path.basename(filePath);
  const parent = path.basename(path.dirname(filePath));
  // From filename e.g., "Something - Trap - Prod.WizardOfAus.wav"
  const prodMatch = name.match(/prod\.([A-Za-z0-9_]+)/i);
  if (prodMatch) return prodMatch[1];
  // From parent folder e.g., MASSIVE BEAT PACK 2025 -> WizardOfAus inferred
  if (/wizardofaus/i.test(parent)) return "WizardOfAus";
  if (/alias/i.test(parent)) return "PRODBYALIAS";
  if (/layz/i.test(parent)) return "Prod.LayZ";
  return "Unknown";
}

function extractTitle(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function extractTempo(filePath) {
  const name = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const parent = path.basename(path.dirname(filePath)).toLowerCase();
  const matchName = name.match(/(\d{2,3})\s*bpm/);
  const matchBracket = name.match(/\[(\d{2,3})\s*bpm/);
  const matchParent = parent.match(/(\d{2,3})\s*bpm/);
  const candidate = matchName?.[1] || matchBracket?.[1] || matchParent?.[1];
  const tempo = candidate ? parseInt(candidate, 10) : null;
  if (tempo && tempo >= 60 && tempo <= 220) return tempo;
  return 90; // safe default to satisfy NOT NULL
}

function inferGenre(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.includes("trap")) return "trap";
  if (lower.includes("drill")) return "drill";
  if (lower.includes("lofi")) return "lofi";
  if (lower.includes("soul") || lower.includes("r&b")) return "rnb";
  return "hip-hop";
}

function contentTypeForExt(ext) {
  const map = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    flac: "audio/flac",
    aac: "audio/aac",
    m4a: "audio/mp4",
  };
  return map[ext.toLowerCase()] || "audio/mpeg";
}

function slugifyName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\-\.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-\.]+|[-\.]+$/g, "");
}

async function uploadFile(filePath) {
  const stats = fs.statSync(filePath);
  const maxBytes = 50 * 1024 * 1024; // Supabase storage default max size ~50MB
  if (stats.size > maxBytes) {
    throw new Error(`File exceeds max size (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1) || "mp3";
  const contentType = contentTypeForExt(ext);
  const destPath = `local/${slugifyName(path.basename(filePath))}`;
  const { data, error } = await supabase.storage.from(BUCKET_BEATS).upload(destPath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET_BEATS).getPublicUrl(destPath);
  return { path: destPath, publicUrl: pub.publicUrl };
}

async function insertBeat(meta) {
  const payload = {
    title: meta.title,
    artist: meta.producer,
    tempo: meta.tempo,
    key_signature: null,
    genre: meta.genre,
    duration_seconds: meta.duration || 0,
    file_url: meta.fileUrl,
    preview_url: meta.fileUrl,
    license_type: LICENSE_TYPE,
    license_url: null,
    source: SOURCE,
    uploaded_by: null,
    is_verified: true,
    is_active: true,
    status: "active",
  };

  const attemptInsert = async () => supabase.from("beats").insert(payload);

  let { error } = await attemptInsert();

  if (error && /uploaded_by/.test(error.message || "")) {
    delete payload.uploaded_by;
    ({ error } = await attemptInsert());
  }

  if (error) {
    if (error.code === "23505") return;
    throw error;
  }
}

async function run() {
  await ensureBucket();
  if (!fs.existsSync(LOCAL_ROOT)) {
    throw new Error(`Local beats path missing: ${LOCAL_ROOT}`);
  }
  const files = walkFiles(LOCAL_ROOT);
  console.log(`Found ${files.length} local audio files.`);
  let success = 0;
  for (const file of files) {
    try {
      const uploaded = await uploadFile(file);
      const meta = {
        title: extractTitle(file),
        producer: extractProducer(file),
        genre: inferGenre(file),
        tempo: extractTempo(file),
        duration: 0,
        fileUrl: uploaded.publicUrl,
      };
      await insertBeat(meta);
      success += 1;
      console.log(`Ingested ${meta.title} by ${meta.producer}`);
    } catch (err) {
      console.error(`Failed ingest for ${file}:`, err.message);
    }
  }
  console.log(`Done. Success: ${success}/${files.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
