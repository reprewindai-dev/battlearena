import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  buildFallbackArtworkSvg,
  inferBeatFlags,
  inferMoodTags,
  parseAudioDurationSeconds,
  slugifyBeat,
} from "@/lib/beats/catalog";

export const RemoteBeatTrackSchema = z.object({
  title: z.string().trim().min(1).max(255),
  artist: z.string().trim().min(1).max(255),
  genre: z.string().trim().min(1).max(80),
  tempo: z.number().int().min(40).max(260),
  audio_url: z.string().url(),
  preview_url: z.string().url().optional(),
  duration_seconds: z.number().int().min(5).max(1800).optional(),
  key_signature: z.string().trim().max(20).optional(),
  license_type: z.string().trim().max(50).default("standard"),
  source: z.string().trim().max(50).default("remote_catalog"),
  external_id: z.string().trim().max(120).optional(),
});

export const RemoteBeatManifestSchema = z.object({
  tracks: z.array(RemoteBeatTrackSchema).min(1).max(50),
});

export type RemoteBeatTrack = z.infer<typeof RemoteBeatTrackSchema>;

function sanitizePathPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "beat";
}

function getFileExtension(input: string, contentType?: string | null) {
  try {
    const pathname = new URL(input).pathname;
    const lastPart = pathname.split("/").pop() ?? "";
    const ext = lastPart.includes(".") ? lastPart.split(".").pop() ?? "" : "";
    if (ext) return sanitizePathPart(ext);
  } catch {
    // noop
  }

  if (contentType?.includes("mpeg")) return "mp3";
  if (contentType?.includes("wav")) return "wav";
  if (contentType?.includes("flac")) return "flac";
  if (contentType?.includes("aac")) return "aac";
  if (contentType?.includes("mp4")) return "m4a";
  return "bin";
}

async function ensureBucket(adminClient: SupabaseClient, bucket: string) {
  const { data, error } = await adminClient.storage.listBuckets();
  if (error) throw new Error(`beats_bucket_list_failed:${error.message}`);
  if ((data ?? []).some((entry) => entry.name === bucket)) {
    return;
  }
  const { error: createError } = await adminClient.storage.createBucket(bucket, { public: true });
  if (createError) {
    throw new Error(`beats_bucket_create_failed:${createError.message}`);
  }
}

async function downloadRemoteAudio(url: string, maxBytes: number) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`remote_audio_download_failed:${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) {
    throw new Error(`remote_audio_too_large:${contentLength}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    throw new Error(`remote_audio_too_large:${buffer.byteLength}`);
  }

  return {
    buffer,
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
  };
}

export async function ingestRemoteBeatCatalog(params: {
  adminClient: SupabaseClient;
  actorUserId: string;
  bucket: string;
  tracks: RemoteBeatTrack[];
}) {
  const { adminClient, actorUserId, bucket, tracks } = params;
  await ensureBucket(adminClient, bucket);

  const results: Array<Record<string, unknown>> = [];
  type ExistingBeat = { id: string; slug: string | null; title: string; artist: string };

  for (const track of tracks) {
    const producerName = track.artist;
    const bpm = track.tempo;
    const slugBase = slugifyBeat(`${track.title}-${producerName}`);

    const { data: existingData } = await adminClient
      .from("beats")
      .select("id,slug,title,artist")
      .eq("slug", slugBase)
      .maybeSingle();
    const existing = (existingData ?? null) as ExistingBeat | null;

    if (existing) {
      results.push({ status: "skipped", reason: "duplicate", beat: existing });
      continue;
    }

    const audioAsset = await downloadRemoteAudio(track.audio_url, 50 * 1024 * 1024);
    const previewAsset = track.preview_url
      ? await downloadRemoteAudio(track.preview_url, 10 * 1024 * 1024)
      : audioAsset;

    const producerSlug = sanitizePathPart(producerName);
    const slug = slugBase;
    const audioPath = `catalog/audio/${producerSlug}/${slug}/main.${getFileExtension(track.audio_url, audioAsset.contentType)}`;
    const previewPath = track.preview_url
      ? `catalog/preview/${producerSlug}/${slug}/preview.${getFileExtension(track.preview_url, previewAsset.contentType)}`
      : audioPath;
    const artworkPath = `catalog/artwork/${producerSlug}/${slug}/cover.svg`;

    const { error: audioUploadError } = await adminClient.storage.from(bucket).upload(audioPath, audioAsset.buffer, {
      contentType: audioAsset.contentType,
      upsert: true,
    });
    if (audioUploadError) {
      throw new Error(`beat_audio_upload_failed:${audioUploadError.message}`);
    }

    if (previewPath !== audioPath) {
      const { error: previewUploadError } = await adminClient.storage.from(bucket).upload(previewPath, previewAsset.buffer, {
        contentType: previewAsset.contentType,
        upsert: true,
      });
      if (previewUploadError) {
        await adminClient.storage.from(bucket).remove([audioPath]);
        throw new Error(`beat_preview_upload_failed:${previewUploadError.message}`);
      }
    }

    const fileUrl = adminClient.storage.from(bucket).getPublicUrl(audioPath).data.publicUrl;
    const previewUrl = adminClient.storage.from(bucket).getPublicUrl(previewPath).data.publicUrl;
    const durationSeconds =
      track.duration_seconds ?? ((await parseAudioDurationSeconds(audioAsset.buffer, audioAsset.contentType).catch(() => 0)) || null);
    const artworkSvg = buildFallbackArtworkSvg({
      title: track.title,
      producerName,
      bpm,
      genre: track.genre,
    });

    const { error: artworkUploadError } = await adminClient.storage.from(bucket).upload(artworkPath, Buffer.from(artworkSvg, "utf8"), {
      contentType: "image/svg+xml",
      upsert: true,
    });
    if (artworkUploadError) {
      const pathsToRemove = previewPath === audioPath ? [audioPath] : [audioPath, previewPath];
      await adminClient.storage.from(bucket).remove(pathsToRemove);
      throw new Error(`beat_artwork_upload_failed:${artworkUploadError.message}`);
    }

    const artworkUrl = adminClient.storage.from(bucket).getPublicUrl(artworkPath).data.publicUrl;
    const flags = inferBeatFlags({
      bpm,
      genre: track.genre,
      usage_count: 0,
    });

    const { data: inserted, error: insertError } = await adminClient
      .from("beats")
      .insert({
        title: track.title,
        artist: track.artist,
        producer_name: producerName,
        slug,
        genre: track.genre,
        tempo: track.tempo,
        bpm,
        key_signature: track.key_signature ?? null,
        musical_key: track.key_signature ?? null,
        mood_tags: inferMoodTags({ genre: track.genre, title: track.title }),
        duration_seconds: durationSeconds,
        artwork_url: artworkUrl,
        artwork_storage_path: artworkPath,
        file_url: fileUrl,
        preview_url: previewUrl,
        audio_storage_path: audioPath,
        preview_storage_path: previewPath,
        license_type: track.license_type,
        source: track.source,
        waveform_status: durationSeconds ? "placeholder_generated" : "pending",
        uploaded_by: actorUserId,
        is_verified: true,
        is_active: true,
        status: "active",
        is_featured: flags.is_featured,
        is_homepage_safe: flags.is_homepage_safe,
        is_tournament_safe: flags.is_tournament_safe,
      })
      .select("id,slug,title,artist,producer_name,genre,tempo,bpm,duration_seconds,artwork_url,file_url,preview_url,created_at")
      .single();

    if (insertError) {
      const pathsToRemove = previewPath === audioPath ? [audioPath, artworkPath] : [audioPath, previewPath, artworkPath];
      await adminClient.storage.from(bucket).remove(pathsToRemove);
      throw new Error(`beat_insert_failed:${insertError.message}`);
    }

    results.push({
      status: "created",
      beat: inserted,
      source_url: track.audio_url,
      external_id: track.external_id ?? null,
    });
  }

  return {
    total: tracks.length,
    created: results.filter((row) => row.status === "created").length,
    skipped: results.filter((row) => row.status === "skipped").length,
    results,
  };
}
