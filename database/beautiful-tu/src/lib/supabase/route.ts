import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/env";

export function createSupabaseRouteClient(request: NextRequest) {
  const publicKey =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    env.SUPABASE_ANON_KEY;
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;

  if (!url || !publicKey) {
    throw new Error("supabase_public_config_missing");
  }

  let response = new NextResponse(null);

  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        response = new NextResponse(null);

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  return {
    supabase,
    getResponse() {
      return response;
    },
  };
}
