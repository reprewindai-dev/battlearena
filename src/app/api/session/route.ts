import { NextResponse } from "next/server";

import { getSessionRole, getSessionUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getSessionUser();
  const role = await getSessionRole();

  return NextResponse.json({
    ok: true,
    user,
    role,
  });
}
