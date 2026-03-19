import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protected routes
  if (req.nextUrl.pathname.startsWith("/app")) {
    if (!session) {
      const redirectUrl = new URL("/auth", req.url);
      redirectUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Admin routes
  if (req.nextUrl.pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/auth", req.url));
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "mod")) {
      return NextResponse.redirect(new URL("/app", req.url));
    }
  }

  // Billing routes
  if (req.nextUrl.pathname.startsWith("/billing")) {
    if (!session) {
      return NextResponse.redirect(new URL("/auth", req.url));
    }
  }

  // API routes that require auth
  if (req.nextUrl.pathname.startsWith("/api")) {
    const protectedRoutes = [
      "/api/billing",
      "/api/battle-session",
      "/api/tournaments",
      "/api/analytics",
    ];

    const isProtected = protectedRoutes.some(route => 
      req.nextUrl.pathname.startsWith(route)
    );

    if (isProtected && !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check subscription limits for paid features
    if (session && req.nextUrl.pathname.startsWith("/api/battle-session")) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: billingProfile } = await supabaseAdmin
        .from("user_billing_profiles")
        .select("active_subscription_plan,active_subscription_status")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const activePlan =
        billingProfile &&
        (billingProfile.active_subscription_status === "active" ||
          billingProfile.active_subscription_status === "trialing")
          ? billingProfile.active_subscription_plan
          : null;

      if (!activePlan || activePlan === "spectator") {
        const { data: usage } = await supabaseAdmin
          .from("usage_tracking")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("event_type", "battle_created")
          .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

        if (usage && usage.length >= 3) {
          return NextResponse.json(
            { error: "Battle limit exceeded for free tier" },
            { status: 429 }
          );
        }
      }
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
