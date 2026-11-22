import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseCookieOptions } from "@/lib/supabase/options";
import { supabasePublicConfig } from "@/lib/supabase/public-env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pub = supabasePublicConfig();
  const url = process.env.SUPABASE_INTERNAL_URL || pub.url;
  const key = pub.key;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    db: { schema: "crmpro" },
      cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        } catch {
          // A bad cookie must not take down the request.
        }
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    return response;
  }
  return response;
}
