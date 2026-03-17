import { NextResponse, type NextRequest } from "next/server";

import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
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
  matcher: ["/app/:path*"],
};
