import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionRole, getSessionUser } from "@/lib/auth/session";

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB
const ALLOWED_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav", "audio/aac", "audio/ogg"];
const VALID_GENRES = ["hip-hop", "trap", "boom-bap", "lo-fi", "drill", "r&b", "pop", "electronic", "rock", "afrobeat"];

export async function POST(req: NextRequest) {
  const role = await getSessionRole();
  const user = await getSessionUser();

  // Only admins and mods can upload beats
  if (role !== "admin" && role !== "mod") {
    return NextResponse.json({ error: "Forbidden. Admin or mod role required." }, { status: 403 });
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const artist = (formData.get("artist") as string | null)?.trim();
  const genre = (formData.get("genre") as string | null)?.trim();
  const tempoRaw = formData.get("tempo") as string | null;
  const keySignature = (formData.get("key_signature") as string | null)?.trim();

  // Validate required fields
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!title || title.length < 2) return NextResponse.json({ error: "Title required (min 2 chars)" }, { status: 400 });
  if (!artist || artist.length < 2) return NextResponse.json({ error: "Artist required (min 2 chars)" }, { status: 400 });
  if (!genre || !VALID_GENRES.includes(genre)) {
    return NextResponse.json({ error: `Genre must be one of: ${VALID_GENRES.join(", ")}` }, { status: 400 });
  }

  const tempo = parseInt(tempoRaw ?? "", 10);
  if (!Number.isFinite(tempo) || tempo < 40 || tempo > 300) {
    return NextResponse.json({ error: "Tempo must be between 40 and 300 BPM" }, { status: 400 });
  }

  // Validate file
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 30 MB)" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type. Allowed: MP3, WAV, AAC, OGG" }, { status: 400 });
  }

  // Upload file to Supabase Storage
  const ext = file.name.split(".").pop() ?? "mp3";
  const filename = `beats/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("beats")
    .upload(filename, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload failed", details: uploadError.message },
      { status: 500 }
    );
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from("beats").getPublicUrl(filename);
  const fileUrl = urlData.publicUrl;

  // Insert beat record
  const { data: beat, error: insertError } = await supabase
    .from("beats")
    .insert({
      title,
      artist,
      genre,
      tempo,
      key_signature: keySignature ?? "C",
      file_url: fileUrl,
      preview_url: fileUrl, // same URL for preview; can be overridden later
      duration_seconds: 0, // will be resolved client-side or via a post-process
      status: "active",
      is_active: true,
      is_verified: role === "admin",
      usage_count: 0,
      uploaded_by: user.id,
    })
    .select("id,title,artist,genre,tempo,key_signature,file_url,preview_url,status,is_verified")
    .single();

  if (insertError) {
    // Attempt to clean up uploaded file
    await supabase.storage.from("beats").remove([filename]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, beat }, { status: 201 });
}
