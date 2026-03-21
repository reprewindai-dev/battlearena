import { NextResponse } from "next/server";

import { buildFallbackArtworkSvg } from "@/lib/beats/catalog";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { slug } = await context.params;

  if (!slug || slug.trim().length === 0) {
    return new NextResponse("missing_slug", { status: 400 });
  }

  const adminClient = createSupabaseServiceRoleClient();
  const { data, error } = await adminClient
    .from("beats")
    .select("title,artist,producer_name,bpm,tempo,genre,is_active,is_verified,status")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return new NextResponse("beat_lookup_failed", { status: 500 });
  }

  if (!data || !data.is_active || !data.is_verified || data.status !== "active") {
    return new NextResponse("not_found", { status: 404 });
  }

  const svg = buildFallbackArtworkSvg({
    title: data.title,
    producerName: data.producer_name ?? data.artist ?? "Unknown Producer",
    bpm: data.bpm ?? data.tempo ?? 90,
    genre: data.genre ?? "battle",
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
