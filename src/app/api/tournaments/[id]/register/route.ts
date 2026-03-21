import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";
import { ensurePublicUserRecord } from "@/lib/users/ensure-public-user";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  const adminClient = createSupabaseServiceRoleClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensurePublicUserRecord(supabase, user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "user_bootstrap_failed" }, { status: 400 });
  }

  const { data: registrationResult, error: registrationError } = await adminClient.rpc(
    "register_tournament_participant_runtime",
    {
      p_tournament_id: id,
      p_user_id: user.id,
    },
  );

  if (registrationError) {
    return NextResponse.json({ error: registrationError.message }, { status: 500 });
  }

  const typedRegistrationResult = (registrationResult ?? {}) as {
    ok?: boolean;
    error?: string;
    status_code?: number;
    current_balance?: number;
    participant?: unknown;
    tournament_name?: string;
  };

  if (!typedRegistrationResult.ok) {
    const responseBody: Record<string, unknown> = {
      error: typedRegistrationResult.error ?? "tournament_registration_failed",
    };

    if (typeof typedRegistrationResult.current_balance === "number") {
      responseBody.current_balance = typedRegistrationResult.current_balance;
    }

    return NextResponse.json(responseBody, {
      status: typeof typedRegistrationResult.status_code === "number" ? typedRegistrationResult.status_code : 409,
    });
  }

  await supabase.from("activity_feed").insert({
    actor_id: user.id,
    type: "joined_tournament",
    subject_id: id,
    subject_type: "tournament",
    meta: { tournament_name: typedRegistrationResult.tournament_name ?? null },
  });

  return NextResponse.json({ participant: typedRegistrationResult.participant }, { status: 201 });
}
