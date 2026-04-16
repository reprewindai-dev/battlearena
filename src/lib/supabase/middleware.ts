import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

export async function updateSupabaseSession(request: NextRequest) {
  const publicKey = getSupabasePublicKey();
  const url = getSupabaseUrl();

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!url || !publicKey) {
    return response;
  }

  const supabase = createServerClient(url, publicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({
          request,
        });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresh auth/session cookies if needed and return the resolved user for middleware RBAC.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user: user ?? null } satisfies { response: NextResponse; user: User | null };
}
