import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

const TournamentCreateSchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    format: z.enum(["single_elimination", "double_elimination", "round_robin", "swiss"]).default("single_elimination"),
    tournament_type: z.enum(["open", "invite_only"]).default("open"),
    max_participants: z.number().int().min(4).max(64).default(16),
    entry_fee_tokens: z.number().int().min(0).max(1_000_000).default(0),
    prize_pool_tokens: z.number().int().min(0).max(10_000_000).default(0),
    starts_at: z.string().datetime(),
    registration_ends_at: z.string().datetime(),
  })
  .superRefine((value, ctx) => {
    const startsAt = new Date(value.starts_at);
    const registrationEndsAt = new Date(value.registration_ends_at);

    if (Number.isNaN(startsAt.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["starts_at"], message: "Invalid start date" });
    }
    if (Number.isNaN(registrationEndsAt.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registration_ends_at"],
        message: "Invalid registration close date",
      });
    }
    if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(registrationEndsAt.getTime()) && registrationEndsAt >= startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registration_ends_at"],
        message: "Registration must close before the tournament starts",
      });
    }
  });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // upcoming|registration|live|completed
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);
  const offset = Number(searchParams.get("offset") ?? "0");

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  let query = supabase
    .from("tournaments")
    .select(`
      id, name, description, status, format, max_participants, tournament_type,
      entry_fee_tokens, prize_pool_tokens, starts_at, registration_closes, registration_opens, created_at,
      created_by,
      participant_count:tournament_participants(count)
    `, { count: "exact" })
    .order("starts_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  } else {
    query = query.in("status", ["upcoming", "registration", "live"]);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    format: string;
    max_participants: number;
    tournament_type: string | null;
    entry_fee_tokens: number;
    prize_pool_tokens: number;
    starts_at: string | null;
    registration_closes: string | null;
    registration_opens: string | null;
    created_at: string;
    created_by: string | null;
    participant_count: Array<{ count: number }>;
  }>;

  return NextResponse.json({
    tournaments: rows.map((row) => ({
      ...row,
      registration_ends_at: row.registration_closes,
    })),
    total: count ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensurePublicUserRecord(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "user_bootstrap_failed" }, { status: 400 });
  }

  const role = (user.app_metadata as { role?: string } | undefined)?.role ?? "user";
  if (role !== "admin" && role !== "mod") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = TournamentCreateSchema.safeParse({
    ...body,
    max_participants: Number(body?.max_participants ?? 16),
    entry_fee_tokens: Number(body?.entry_fee_tokens ?? 0),
    prize_pool_tokens: Number(body?.prize_pool_tokens ?? 0),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const registrationOpens = new Date().toISOString();
  const status = "registration";

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ? parsed.data.description : null,
      format: parsed.data.format,
      tournament_type: parsed.data.tournament_type,
      max_participants: parsed.data.max_participants,
      entry_fee_tokens: parsed.data.entry_fee_tokens,
      prize_pool_tokens: parsed.data.prize_pool_tokens,
      starts_at: parsed.data.starts_at,
      registration_closes: parsed.data.registration_ends_at,
      registration_opens: registrationOpens,
      status,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tournament: data }, { status: 201 });
}
