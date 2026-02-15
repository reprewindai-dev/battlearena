import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("arena_role", "admin", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
  res.cookies.set("arena_mock_session", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
  return res;
}
