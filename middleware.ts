import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/app"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow mock session (Playwright helper)
  const mockSession = req.cookies.get("arena_mock_session")?.value === "1";
  const supabaseAuthCookie = req.cookies.get("sb-access-token") || req.cookies.get("sb:token");

  if (pathname.startsWith("/app") && !mockSession && !supabaseAuthCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/app/admin")) {
    const role = req.cookies.get("arena_role")?.value;
    if (role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/app/moderation")) {
    const role = req.cookies.get("arena_role")?.value;
    if (role !== "admin" && role !== "mod") {
      const url = req.nextUrl.clone();
      url.pathname = "/app";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
