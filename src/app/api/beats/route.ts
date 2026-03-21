import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildFallbackArtworkSvg,
  inferBeatFlags,
  inferMoodTags,
  parseAudioDurationSeconds,
  slugifyBeat,
} from "@/lib/beats/catalog";
import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

const SORTABLE_FIELDS = new Set(["usage_count", "created_at", "tempo", "bpm", "title"]);

const BeatMetadataSchema = z.object({
  title: z.string().min(1).max(255),
  artist: z.string().min(1).max(255),
  tempo: z.number().int().min(40).max(260),
  genre: z.string().min(1).max(80),
  key_signature: z.string().max(20).optional().nullable(),
  duration_seconds: z.number().int().min(5).max(1800).optional().nullable(),
  license_type: z.string().max(50).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  featured: z.boolean().optional(),
  homepage_safe: z.boolean().optional(),
  tournament_safe: z.boolean().optional(),
});

function sanitizePathPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "beat";
}

function getFileExtension(filename: string) {
  const parts = filename.split(".");
  if (parts.length < 2) return "bin";
  return sanitizePathPart(parts.pop() || "bin");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const genre = url.searchParams.get("genre") ?? "all";
    const tempoMin = Number(url.searchParams.get("tempo_min") ?? 60);
    const tempoMax = Number(url.searchParams.get("tempo_max") ?? 200);
    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 50;
    const sortByRaw = url.searchParams.get("sort_by") ?? "usage_count";
    const sortBy = SORTABLE_FIELDS.has(sortByRaw) ? sortByRaw : "usage_count";
    const sortOrder = url.searchParams.get("sort_order") === "asc" ? "asc" : "desc";
    const featuredOnly = url.searchParams.get("featured") === "true";
    const homepageSafeOnly = url.searchParams.get("homepage_safe") === "true";
    const tournamentSafeOnly = url.searchParams.get("tournament_safe") === "true";

    let beatsClient;
    let mode: "supabase" | "supabase_public" = "supabase";
    try {
      beatsClient = createSupabaseServiceRoleClient();
    } catch (error) {
      console.warn("api/beats: service role unavailable, falling back to public client", error);
      beatsClient = createSupabasePublicClient();
      mode = "supabase_public";
    }

    let query = beatsClient
      .from("beats")
      .select(
        "id,title,artist,producer_name,slug,tempo,bpm,key_signature,musical_key,genre,mood_tags,duration_seconds,preview_url,file_url,audio_storage_path,preview_storage_path,artwork_url,license_type,usage_count,is_featured,is_homepage_safe,is_tournament_safe,waveform_status,created_at",
      )
      .eq("is_active", true)
      .eq("is_verified", true)
      .eq("status", "active")
      .not("file_url", "is", null)
      .not("preview_url", "is", null)
      .not("artwork_url", "is", null)
      .gt("duration_seconds", 0);

    if (genre && genre !== "all") {
      query = query.eq("genre", genre);
    }
    if (featuredOnly) {
      query = query.eq("is_featured", true);
    }
    if (homepageSafeOnly) {
      query = query.eq("is_homepage_safe", true);
    }
    if (tournamentSafeOnly) {
      query = query.eq("is_tournament_safe", true);
    }

    if (Number.isFinite(tempoMin)) {
      query = query.gte("bpm", Math.max(0, tempoMin));
    }
    if (Number.isFinite(tempoMax)) {
      query = query.lte("bpm", Math.max(0, tempoMax));
    }

    query = query.order(sortBy === "tempo" ? "bpm" : sortBy, { ascending: sortOrder === "asc" }).limit(limit);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "beats_fetch_failed", details: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      mode,
      beats: data ?? [],
      total: data?.length ?? 0,
      filters: {
        genre,
        tempoMin,
        tempoMax,
        limit,
        sortBy,
        sortOrder,
        featuredOnly,
        homepageSafeOnly,
        tournamentSafeOnly,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "server_error",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const role = await getSessionRole();
    if (role !== "admin" && role !== "mod") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const beatDataRaw = formData.get("beatData");
    const audioFile = formData.get("audioFile");
    const previewFile = formData.get("previewFile");

    if (!(audioFile instanceof File) || !(previewFile instanceof File)) {
      return NextResponse.json({ error: "audio_and_preview_files_required" }, { status: 400 });
    }

    if (typeof beatDataRaw !== "string") {
      return NextResponse.json({ error: "beat_metadata_required" }, { status: 400 });
    }

    const metadataParse = BeatMetadataSchema.safeParse(JSON.parse(beatDataRaw));
    if (!metadataParse.success) {
      return NextResponse.json(
        { error: "invalid_beat_metadata", details: metadataParse.error.flatten() },
        { status: 400 },
      );
    }

    if (!audioFile.type.startsWith("audio/") || !previewFile.type.startsWith("audio/")) {
      return NextResponse.json({ error: "invalid_file_types" }, { status: 400 });
    }

    if (audioFile.size > 50 * 1024 * 1024 || previewFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "files_too_large" }, { status: 400 });
    }

    const adminClient = createSupabaseServiceRoleClient();
    await ensurePublicUserRecord(adminClient, user);
    const bucket = process.env.BEATS_STORAGE_BUCKET ?? "beats";

    const payload = metadataParse.data;
    const slug = slugifyBeat(`${payload.title}-${randomUUID().slice(0, 8)}`);
    const fileStem = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizePathPart(payload.title)}`;
    const audioPath = `audio/${user.id}/${fileStem}.${getFileExtension(audioFile.name)}`;
    const previewPath = `preview/${user.id}/${fileStem}.${getFileExtension(previewFile.name)}`;
    const artworkPath = `artwork/generated/${slug}.svg`;

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const previewBuffer = Buffer.from(await previewFile.arrayBuffer());
    const inferredDuration = await parseAudioDurationSeconds(audioBuffer, audioFile.type).catch(() => 0);

    const audioUpload = await adminClient.storage.from(bucket).upload(audioPath, audioBuffer, {
      contentType: audioFile.type,
      upsert: false,
    });
    if (audioUpload.error) {
      return NextResponse.json({ error: "audio_upload_failed", details: audioUpload.error.message }, { status: 500 });
    }

    const previewUpload = await adminClient.storage.from(bucket).upload(previewPath, previewBuffer, {
      contentType: previewFile.type,
      upsert: false,
    });
    if (previewUpload.error) {
      await adminClient.storage.from(bucket).remove([audioPath]);
      return NextResponse.json({ error: "preview_upload_failed", details: previewUpload.error.message }, { status: 500 });
    }

    const artworkSvg = buildFallbackArtworkSvg({
      title: payload.title,
      producerName: payload.artist,
      bpm: payload.tempo,
      genre: payload.genre,
    });
    const artworkUpload = await adminClient.storage.from(bucket).upload(artworkPath, Buffer.from(artworkSvg, "utf8"), {
      contentType: "image/svg+xml",
      upsert: true,
    });
    if (artworkUpload.error) {
      await adminClient.storage.from(bucket).remove([audioPath, previewPath]);
      return NextResponse.json({ error: "artwork_upload_failed", details: artworkUpload.error.message }, { status: 500 });
    }

    const audioPublic = adminClient.storage.from(bucket).getPublicUrl(audioPath).data.publicUrl;
    const previewPublic = adminClient.storage.from(bucket).getPublicUrl(previewPath).data.publicUrl;
    const artworkPublic = adminClient.storage.from(bucket).getPublicUrl(artworkPath).data.publicUrl;
    const flags = inferBeatFlags({ bpm: payload.tempo, genre: payload.genre, usage_count: 0 });

    const { data: inserted, error: insertError } = await adminClient
      .from("beats")
      .insert({
        title: payload.title,
        artist: payload.artist,
        producer_name: payload.artist,
        slug,
        tempo: payload.tempo,
        bpm: payload.tempo,
        key_signature: payload.key_signature ?? null,
        musical_key: payload.key_signature ?? null,
        genre: payload.genre,
        mood_tags: payload.tags?.length ? payload.tags : inferMoodTags({ genre: payload.genre, title: payload.title }),
        duration_seconds: payload.duration_seconds ?? inferredDuration ?? null,
        file_url: audioPublic,
        preview_url: previewPublic,
        audio_storage_path: audioPath,
        preview_storage_path: previewPath,
        artwork_url: artworkPublic,
        artwork_storage_path: artworkPath,
        license_type: payload.license_type ?? "standard",
        waveform_status: "placeholder_generated",
        uploaded_by: user.id,
        is_active: true,
        is_verified: true,
        status: "active",
        is_featured: payload.featured ?? flags.is_featured,
        is_homepage_safe: payload.homepage_safe ?? flags.is_homepage_safe,
        is_tournament_safe: payload.tournament_safe ?? flags.is_tournament_safe,
      })
      .select("id,title,artist,producer_name,slug,tempo,bpm,key_signature,musical_key,genre,mood_tags,duration_seconds,preview_url,file_url,audio_storage_path,preview_storage_path,artwork_url,license_type,usage_count,is_featured,is_homepage_safe,is_tournament_safe,waveform_status,created_at")
      .single();

    if (insertError) {
      await adminClient.storage.from(bucket).remove([audioPath, previewPath, artworkPath]);
      return NextResponse.json({ error: "beat_insert_failed", details: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mode: "supabase", beat: inserted }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "upload_failed",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
