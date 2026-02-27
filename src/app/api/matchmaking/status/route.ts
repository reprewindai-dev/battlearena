import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { getStatus } from "@/lib/matchmaking/production";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "freestyle";

  try {
    const result = await getStatus(user.id, mode);
    
    if (!result) {
      return NextResponse.json({ 
        ok: true, 
        mode: "supabase", 
        status: "none", 
        battleId: null 
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "supabase",
      status: result.status,
      battleId: result.battle_id,
      data: result
    });
  } catch (error) {
    console.error('Matchmaking status error:', error);
    return NextResponse.json({ 
      error: "status_failed", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 400 });
  }
}
