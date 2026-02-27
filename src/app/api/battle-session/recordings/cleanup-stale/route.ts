import { NextResponse } from "next/server";

import { getSessionRole, getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { env } from "@/env";

type CleanupResult = {
  ok: true;
  mode: "supabase";
  scanned_rows: number;
  deleted_rows: number;
  deleted_objects: number;
  row_delete_errors: number;
  object_delete_errors: number;
};

async function asyncPool<T>(
  concurrency: number,
  items: T[],
  worker: (item: T) => Promise<void>,
) {
  const queue = items.slice();
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });

  await Promise.all(workers);
}

export async function POST(req: Request) {
  const cronSecret = req.headers.get("x-cron-secret");
  const expected = env.CRON_CLEANUP_SECRET;
  const cronAuthed = Boolean(expected && cronSecret && cronSecret === expected);

  let actorUserId: string | null = null;

  if (!cronAuthed) {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    actorUserId = user.id;

    const role = await getSessionRole();
    if (role !== "admin" && role !== "mod") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const url = new URL(req.url);
  const minutesRaw = url.searchParams.get("minutes");
  const minutes = minutesRaw ? Number(minutesRaw) : 15;
  const safeMinutes = Number.isFinite(minutes) ? Math.max(1, Math.min(24 * 60, Math.floor(minutes))) : 15;

  const batchSizeRaw = url.searchParams.get("batch");
  const batchSize = batchSizeRaw ? Number(batchSizeRaw) : 200;
  const safeBatchSize = Number.isFinite(batchSize) ? Math.max(1, Math.min(1000, Math.floor(batchSize))) : 200;

  const concurrencyRaw = url.searchParams.get("concurrency");
  const concurrency = concurrencyRaw ? Number(concurrencyRaw) : 4;
  const safeConcurrency = Number.isFinite(concurrency) ? Math.max(1, Math.min(10, Math.floor(concurrency))) : 4;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const serviceSupabase = await createSupabaseServiceRoleClient();
  if (!serviceSupabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - safeMinutes * 60 * 1000).toISOString;

  let scannedRows = 0;
  let deletedObjects = 0;
  let deletedRows = 0;
  let rowDeleteErrors = 0;
  let objectDeleteErrors = 0;

  // Paginate by created_at ascending to avoid repeatedly scanning the same newest rows.
  let lastCreatedAt: string | null = null;

  while (true) {
    let rows: unknown[] | null = null;
    let fetchError: { message: string } | null = null;

    // Prefer RPC (service role can always call it; user session subject to RLS).
    try {
      const rpcRes: { data: unknown[] | null; error: { message: string } | null } = await supabase.rpc(
        "list_stale_recordings",
        {
        cutoff,
        after_created_at: lastCreatedAt,
        batch_size: safeBatchSize,
        },
      );
      rows = (rpcRes.data as unknown[] | null) ?? null;
      fetchError = rpcRes.error ? { message: rpcRes.error.message } : null;
    } catch {
      // ignore and fall back
    }

    if (!rows && !fetchError) {
      let query = supabase
        .from("battle_recordings")
        .select("id,storage_bucket,storage_path,created_at")
        .is("uploaded_at", null)
        .lt("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(safeBatchSize);

      if (lastCreatedAt) {
        query = query.gt("created_at", lastCreatedAt);
      }

      const fallbackRes = await query;
      rows = (fallbackRes.data as unknown[] | null) ?? null;
      fetchError = fallbackRes.error ? { message: fallbackRes.error.message } : null;
    }

    if (fetchError) {
      return NextResponse.json(
        { error: "stale_recordings_fetch_failed", details: fetchError.message },
        { status: 400 },
      );
    }

    if (!rows || rows.length === 0) break;
    scannedRows += rows.length;
    lastCreatedAt = (rows[rows.length - 1] as { created_at?: string | null }).created_at ?? lastCreatedAt;

    await asyncPool(safeConcurrency, rows, async (row) => {
      const bucket = (row as { storage_bucket?: string | null }).storage_bucket ?? null;
      const path = (row as { storage_path?: string | null }).storage_path ?? null;
      const id = (row as { id?: string }).id;
      if (!id) return;

      if (bucket && path) {
        try {
          const { error: objError } = await supabase.storage.from(bucket).remove([path]);
          if (objError) objectDeleteErrors += 1;
          else deletedObjects += 1;
        } catch {
          objectDeleteErrors += 1;
        }
      }

      try {
        const { error: delError } = await supabase
          .from("battle_recordings")
          .delete()
          .eq("id", id)
          .is("uploaded_at", null);
        if (delError) rowDeleteErrors += 1;
        else deletedRows += 1;
      } catch {
        rowDeleteErrors += 1;
      }
    });

    // If we got less than a full batch, we are done.
    if (rows.length < safeBatchSize) break;
  }

  const res: CleanupResult = {
    ok: true,
    mode: "supabase",
    scanned_rows: scannedRows,
    deleted_rows: deletedRows,
    deleted_objects: deletedObjects,
    row_delete_errors: rowDeleteErrors,
    object_delete_errors: objectDeleteErrors,
  };

  try {
    await supabase.from("admin_audit_log").insert({
      actor_user_id: actorUserId,
      action: "recordings_cleanup_stale",
      payload: {
        minutes: safeMinutes,
        batch: safeBatchSize,
        concurrency: safeConcurrency,
        cron_authed: cronAuthed,
        ...res,
      },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json(res);
}
