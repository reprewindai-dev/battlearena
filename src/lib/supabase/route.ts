import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createSupabaseRouteClient(request: NextRequest) {
  const publicKey = getSupabasePublicKey();
  const url = getSupabaseUrl();

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
