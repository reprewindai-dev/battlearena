import { NextRequest, NextResponse } from "next/server";

import { getSessionRole } from "@/lib/auth/session";
import {
  buildFallbackArtworkSvg,
  inferBeatFlags,
  inferMoodTags,
  parseAudioDurationSeconds,
  parseStoragePathFromPublicUrl,
  slugifyBeat,
} from "@/lib/beats/catalog";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

const LIMIT = 100;

type BeatRow = {
  id: string;
  title: string;
  slug: string | null;
  artist: string | null;
  producer_name: string | null;
  genre: string | null;
  tempo: number | null;
  bpm: number | null;
  key_signature: string | null;
  musical_key: string | null;
  mood_tags: string[] | null;
  duration_seconds: number | null;
  preview_url: string | null;
  file_url: string | null;
  artwork_url: string | null;
  artwork_storage_path: string | null;
  audio_storage_path: string | null;
  preview_storage_path: string | null;
  usage_count: number | null;
  is_active: boolean | null;
  is_verified: boolean | null;
  status: string | null;
};

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_CLEANUP_SECRET;
  const cronAuthed = Boolean(expectedSecret && cronSecret && cronSecret === expectedSecret);
  const role = cronAuthed ? "admin" : await getSessionRole();

  if (role !== "admin" && role !== "mod") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const adminClient = createSupabaseServiceRoleClient();
  const bucket = process.env.BEATS_STORAGE_BUCKET ?? "beats";
  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(Number(body.limit ?? LIMIT) || LIMIT, 250));

  const { data, error } = await adminClient
    .from("beats")
    .select("id,title,slug,artist,producer_name,genre,tempo,bpm,key_signature,musical_key,mood_tags,duration_seconds,preview_url,file_url,artwork_url,artwork_storage_path,audio_storage_path,preview_storage_path,usage_count,is_active,is_verified,status")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as BeatRow[];
  let normalized = 0;
  let activated = 0;
  let artworkGenerated = 0;
  let durationsParsed = 0;

  for (const beat of rows) {
    const producerName = beat.producer_name ?? beat.artist ?? "Unknown Producer";
    const bpm = beat.bpm ?? beat.tempo ?? 90;
    const slug = beat.slug ?? slugifyBeat(`${beat.title}-${beat.id.slice(0, 8)}`);
    const moodTags = beat.mood_tags && beat.mood_tags.length > 0 ? beat.mood_tags : inferMoodTags({ genre: beat.genre, title: beat.title });
    const musicalKey = beat.musical_key ?? beat.key_signature ?? null;
    const audioStoragePath = beat.audio_storage_path ?? parseStoragePathFromPublicUrl(beat.file_url);
    const previewStoragePath = beat.preview_storage_path ?? parseStoragePathFromPublicUrl(beat.preview_url);

    let durationSeconds = beat.duration_seconds ?? 0;
    if ((!durationSeconds || durationSeconds <= 0) && beat.file_url) {
      try {
        const response = await fetch(beat.file_url);
        if (response.ok) {
          const mimeType = response.headers.get("content-type");
          const buffer = Buffer.from(await response.arrayBuffer());
          durationSeconds = await parseAudioDurationSeconds(buffer, mimeType);
          if (durationSeconds > 0) {
            durationsParsed += 1;
          }
        }
      } catch {
        // leave duration as-is
      }
    }

    let artworkUrl = beat.artwork_url;
    let artworkStoragePath = beat.artwork_storage_path;
    if (!artworkUrl) {
      const artworkPath = `artwork/generated/${slug}.svg`;
      const svg = buildFallbackArtworkSvg({
        title: beat.title,
        producerName,
        bpm,
        genre: beat.genre,
      });

      const upload = await adminClient.storage.from(bucket).upload(artworkPath, Buffer.from(svg, "utf8"), {
        contentType: "image/svg+xml",
        upsert: true,
      });

      if (!upload.error) {
        artworkStoragePath = artworkPath;
        artworkUrl = adminClient.storage.from(bucket).getPublicUrl(artworkPath).data.publicUrl;
        artworkGenerated += 1;
      }
    }

    const flags = inferBeatFlags({ bpm, genre: beat.genre, usage_count: beat.usage_count });
    const hasRequiredFields = Boolean(
      beat.title &&
      producerName &&
      bpm > 0 &&
      beat.genre &&
      durationSeconds > 0 &&
      artworkUrl &&
      beat.file_url &&
      previewStoragePath &&
      audioStoragePath,
    );

    const status = hasRequiredFields ? "active" : "inactive";
    const isActive = hasRequiredFields;
    const isVerified = hasRequiredFields;

    const { error: updateError } = await adminClient
      .from("beats")
      .update({
        slug,
        producer_name: producerName,
        bpm,
        musical_key: musicalKey,
        mood_tags: moodTags,
        duration_seconds: durationSeconds,
        artwork_url: artworkUrl,
        artwork_storage_path: artworkStoragePath,
        audio_storage_path: audioStoragePath,
        preview_storage_path: previewStoragePath,
        waveform_status: durationSeconds > 0 ? "placeholder_generated" : "pending",
        is_featured: hasRequiredFields ? flags.is_featured : false,
        is_homepage_safe: hasRequiredFields ? flags.is_homepage_safe : false,
        is_tournament_safe: hasRequiredFields ? flags.is_tournament_safe : false,
        status,
        is_active: isActive,
        is_verified: isVerified,
        updated_at: new Date().toISOString(),
      })
      .eq("id", beat.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message, beatId: beat.id }, { status: 500 });
    }

    normalized += 1;
    if (hasRequiredFields) {
      activated += 1;
    }
  }

  const { count: activeCount } = await adminClient
    .from("beats")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("is_verified", true)
    .eq("status", "active")
    .not("artwork_url", "is", null)
    .gt("duration_seconds", 0);

  return NextResponse.json({
    ok: true,
    cronAuthed,
    processed: rows.length,
    normalized,
    activated,
    artworkGenerated,
    durationsParsed,
    activeCatalogCount: activeCount ?? 0,
  });
}
