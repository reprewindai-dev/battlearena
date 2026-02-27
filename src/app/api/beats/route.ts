import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { BeatService } from '@/lib/services/BeatService';

// GET /api/beats?genre=hip-hop&tempo_min=80&tempo_max=140&limit=50
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const genre = url.searchParams.get("genre") ?? "all";
    const tempoMin = Number(url.searchParams.get("tempo_min") ?? 60);
    const tempoMax = Number(url.searchParams.get("tempo_max") ?? 200);
    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 50;
    const sortBy = url.searchParams.get("sort_by") ?? "usage_count";
    const sortOrder = url.searchParams.get("sort_order") ?? "desc";
    const minRating = Number(url.searchParams.get("min_rating")) ?? null;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from("beats")
      .select(
        "id,title,artist,tempo,key_signature,genre,duration_seconds,preview_url,file_url,license_type,license_url,source,usage_count,created_at,status,is_active,is_verified,tags,rating"
      )
      .eq("is_active", true)
      .eq("status", "active");

    if (genre && genre !== "all") {
      query = query.eq("genre", genre);
    }

    if (Number.isFinite(tempoMin)) {
      query = query.gte("tempo", Math.max(0, tempoMin));
    }
    if (Number.isFinite(tempoMax)) {
      query = query.lte("tempo", Math.max(0, tempoMax));
    }

    if (minRating && Number.isFinite(minRating)) {
      query = query.gte("rating", minRating);
    }

    // Sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "beats_fetch_failed", details: error.message }, { status: 400 });
    }

    // Return real beats with proper structure
    return NextResponse.json({ 
      ok: true, 
      mode: "supabase", 
      beats: data || [],
      total: data?.length || 0,
      filters: {
        genre,
        tempoMin,
        tempoMax,
        limit,
        sortBy,
        sortOrder,
        minRating
      }
    });

  } catch (error: any) {
    console.error('Error in beats API:', error);
    return NextResponse.json({ 
      error: "server_error", 
      details: error.message || "Unknown error occurred" 
    }, { status: 500 });
  }
}

// POST /api/beats - Upload new beat
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const beatData = JSON.parse(formData.get('beatData') as string);
    const audioFile = formData.get('audioFile') as File;
    const previewFile = formData.get('previewFile') as File;

    if (!audioFile || !previewFile) {
      return NextResponse.json({ error: "audio and preview files required" }, { status: 400 });
    }

    // Validate file types
    if (!audioFile.type.startsWith('audio/') || !previewFile.type.startsWith('audio/')) {
      return NextResponse.json({ error: "invalid file types" }, { status: 400 });
    }

    // Validate file sizes (max 50MB for audio, 10MB for preview)
    if (audioFile.size > 50 * 1024 * 1024 || previewFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "files too large" }, { status: 400 });
    }

    // TODO: Implement actual file upload to storage service
    // For now, return success response
    return NextResponse.json({
      ok: true,
      message: "Beat upload received - processing",
      beatData: {
        title: beatData.title,
        artist: beatData.artist,
        tempo: beatData.tempo,
        genre: beatData.genre
      }
    });

  } catch (error: any) {
    console.error('Error in beat upload:', error);
    return NextResponse.json({ 
      error: "upload_failed", 
      details: error.message || "Unknown error occurred" 
    }, { status: 500 });
  }
}

async function getCurrentUser() {
  // TODO: Implement proper user authentication
  // For now, return a mock user for testing
  return {
    id: 'test-user-id',
    email: 'test@arena.com'
  };
}
