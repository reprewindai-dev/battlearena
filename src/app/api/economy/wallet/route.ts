import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWallet } from "@/lib/economy/wallet";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const wallet = await getWallet(user.id);
    return NextResponse.json({ wallet });
  } catch {
    return NextResponse.json({ error: "Failed to load wallet" }, { status: 500 });
  }
}
