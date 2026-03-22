import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type CountRow = {
  total_beats: number;
  launch_safe_beats: number;
  featured_beats: number;
  homepage_safe_beats: number;
  tournament_safe_beats: number;
  malformed_active_beats: number;
  placeholder_active_beats: number;
};

async function run() {
  const [
    totalRes,
    launchSafeRes,
    featuredRes,
    homepageSafeRes,
    tournamentSafeRes,
    malformedActiveRes,
    placeholderRowsRes,
  ] = await Promise.all([
    supabase.from("beats").select("id", { count: "exact", head: true }),
    supabase
      .from("beats")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_verified", true)
      .eq("status", "active")
      .gt("duration_seconds", 0)
      .not("file_url", "is", null)
      .not("preview_url", "is", null)
      .not("artwork_url", "is", null),
    supabase
      .from("beats")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_verified", true)
      .eq("status", "active")
      .eq("is_featured", true),
    supabase
      .from("beats")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_verified", true)
      .eq("status", "active")
      .eq("is_homepage_safe", true),
    supabase
      .from("beats")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_verified", true)
      .eq("status", "active")
      .eq("is_tournament_safe", true),
    supabase
      .from("beats")
      .select("id,file_url,preview_url,artwork_url,duration_seconds")
      .eq("is_active", true),
    supabase
      .from("beats")
      .select("id")
      .eq("is_active", true)
      .or("file_url.like.https://example.com/%,preview_url.like.https://example.com/%"),
  ]);

  const failuresFromQueries = [
    totalRes.error,
    launchSafeRes.error,
    featuredRes.error,
    homepageSafeRes.error,
    tournamentSafeRes.error,
    malformedActiveRes.error,
    placeholderRowsRes.error,
  ].filter(Boolean);

  if (failuresFromQueries.length > 0) {
    throw new Error(
      `beats_verify_query_failed:${failuresFromQueries.map((error) => error?.message ?? "unknown").join("|")}`,
    );
  }

  const malformedActiveBeats = (malformedActiveRes.data ?? []).filter((beat) => {
    const duration = Number(beat.duration_seconds ?? 0);
    return (
      duration <= 0 ||
      !beat.file_url ||
      !beat.preview_url ||
      !beat.artwork_url
    );
  }).length;

  const row: CountRow = {
    total_beats: totalRes.count ?? 0,
    launch_safe_beats: launchSafeRes.count ?? 0,
    featured_beats: featuredRes.count ?? 0,
    homepage_safe_beats: homepageSafeRes.count ?? 0,
    tournament_safe_beats: tournamentSafeRes.count ?? 0,
    malformed_active_beats: malformedActiveBeats,
    placeholder_active_beats: placeholderRowsRes.data?.length ?? 0,
  };

  const failures: string[] = [];

  if (row.launch_safe_beats < 25) {
    failures.push(`launch_safe_beats_below_threshold:${row.launch_safe_beats}`);
  }
  if (row.malformed_active_beats > 0) {
    failures.push(`malformed_active_beats_present:${row.malformed_active_beats}`);
  }
  if (row.placeholder_active_beats > 0) {
    failures.push(`placeholder_active_beats_present:${row.placeholder_active_beats}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        counts: row,
        failures,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
