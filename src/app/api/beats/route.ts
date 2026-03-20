import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

const SORTABLE_FIELDS = new Set(["usage_count", "created_at", "tempo", "title"]);

const BeatMetadataSchema = z.object({
  title: z.string().min(1).max(255),
  artist: z.string().min(1).max(255),
  tempo: z.number().int().min(40).max(260),
  genre: z.string().min(1).max(80),
  key_signature: z.string().max(20).optional().nullable(),
  duration_seconds: z.number().int().min(5).max(1800).optional().nullable(),
  license_type: z.string().max(50).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
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

    let adminClient;
    try {
      adminClient = createSupabaseServiceRoleClient();
    } catch (error) {
      console.warn("api/beats: service role unavailable, returning empty beat list", error);
      return NextResponse.json({
        ok: true,
        mode: "supabase",
        beats: [],
        total: 0,
        degraded: true,
        reason: "supabase_service_role_unavailable",
        filters: {
          genre,
          tempoMin,
          tempoMax,
          limit,
          sortBy,
          sortOrder,
        },
      });
    }

    let query = adminClient
      .from("beats")
      .select("id,title,artist,tempo,key_signature,genre,duration_seconds,preview_url,file_url,license_type,usage_count,created_at")
      .eq("is_active", true);

    if (genre && genre !== "all") {
      query = query.eq("genre", genre);
    }

    if (Number.isFinite(tempoMin)) {
      query = query.gte("tempo", Math.max(0, tempoMin));
    }
    if (Number.isFinite(tempoMax)) {
      query = query.lte("tempo", Math.max(0, tempoMax));
    }

    query = query.order(sortBy, { ascending: sortOrder === "asc" }).limit(limit);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "beats_fetch_failed", details: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      mode: "supabase",
      beats: data ?? [],
      total: data?.length ?? 0,
      filters: {
        genre,
        tempoMin,
        tempoMax,
        limit,
        sortBy,
        sortOrder,
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

    const fileStem = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizePathPart(metadataParse.data.title)}`;
    const audioPath = `audio/${user.id}/${fileStem}.${getFileExtension(audioFile.name)}`;
    const previewPath = `preview/${user.id}/${fileStem}.${getFileExtension(previewFile.name)}`;

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const previewBuffer = Buffer.from(await previewFile.arrayBuffer());

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

    const audioPublic = adminClient.storage.from(bucket).getPublicUrl(audioPath).data.publicUrl;
    const previewPublic = adminClient.storage.from(bucket).getPublicUrl(previewPath).data.publicUrl;

    const payload = metadataParse.data;
    const { data: inserted, error: insertError } = await adminClient
      .from("beats")
      .insert({
        title: payload.title,
        artist: payload.artist,
        tempo: payload.tempo,
        key_signature: payload.key_signature ?? null,
        genre: payload.genre,
        duration_seconds: payload.duration_seconds ?? null,
        file_url: audioPublic,
        preview_url: previewPublic,
        license_type: payload.license_type ?? "standard",
        uploaded_by: user.id,
        is_active: true,
      })
      .select("id,title,artist,tempo,key_signature,genre,duration_seconds,preview_url,file_url,license_type,usage_count,created_at")
      .single();

    if (insertError) {
      await adminClient.storage.from(bucket).remove([audioPath, previewPath]);
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
