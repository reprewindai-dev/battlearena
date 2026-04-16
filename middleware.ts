import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");

  // Canonical redirect: enforce https://spitzone.com (no www, always https)
  const isWww = host.startsWith("www.");
  const isHttp = proto === "http";
  if (isWww || isHttp) {
    const canonicalUrl = req.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.host = "spitzone.com";
    return NextResponse.redirect(canonicalUrl, { status: 301 });
  }

  if (pathname === "/app/battles/pvp") {
    const url = req.nextUrl.clone();
    url.pathname = "/app/battles/room";
    return NextResponse.redirect(url);
  }

  const botRoomMatch = pathname.match(/^\/app\/battles\/bot-room\/([^/]+)$/);
  if (botRoomMatch) {
    const url = req.nextUrl.clone();
    url.pathname = "/app/battles/room";
    url.searchParams.set("battleId", botRoomMatch[1]);
    return NextResponse.redirect(url);
  }

  const { response: supabaseResponse, user } = await updateSupabaseSession(req);

  if (pathname.startsWith("/app") && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const roleClaim = user
    ? ((user.app_metadata as { role?: unknown } | undefined)?.role ??
      (user.user_metadata as { role?: unknown } | undefined)?.role)
    : null;
  const role = roleClaim === "admin" || roleClaim === "mod" || roleClaim === "user" ? roleClaim : "user";

  if (pathname.startsWith("/app/admin")) {
    if (role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/app/moderation")) {
    if (role !== "admin" && role !== "mod") {
      const url = req.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
    matcher: ["/app/:path*", "/", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
