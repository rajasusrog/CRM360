import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { resolveAuthDestination, resolveSessionFromClient, safeNextPath } from "@/lib/auth-routing";
import { CRM_SCHEMA, supabaseCookieOptions, type CrmDatabase } from "@/lib/supabase/options";
import { getConfiguredAppOrigin, supabasePublicConfig } from "@/lib/supabase/public-env";

function loginRedirect(origin: string, message: string) {
  const login = new URL("/login", origin);
  login.searchParams.set("error", message.slice(0, 180));
  return NextResponse.redirect(login);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const canonicalOrigin = getConfiguredAppOrigin() || url.origin;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const validatedNext = safeNextPath(url.searchParams.get("next"), canonicalOrigin);

  const { url: supabaseUrl, key } = supabasePublicConfig();
  const effectiveUrl = process.env.SUPABASE_INTERNAL_URL || supabaseUrl;
  if (!effectiveUrl || !key) {
    return loginRedirect(canonicalOrigin, "Sign-in is not configured on this deployment.");
  }

  const cookieMap = new Map(request.cookies.getAll().map((cookie) => [cookie.name, cookie.value]));
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient<CrmDatabase, typeof CRM_SCHEMA>(effectiveUrl, key, {
    db: { schema: CRM_SCHEMA },
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieMap.set(name, value);
          pendingCookies.push({ name, value, options });
        }
      },
    },
  });

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return loginRedirect(canonicalOrigin, error.message);
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "email" | "magiclink" | "signup" | "invite" | "recovery",
      });
      if (error) return loginRedirect(canonicalOrigin, error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in could not be completed.";
    return loginRedirect(canonicalOrigin, message);
  }

  const session = await resolveSessionFromClient(supabase, true);
  const destination = resolveAuthDestination(session, {
    requestedNext: validatedNext,
    allowedOrigin: canonicalOrigin,
  });

  const response = NextResponse.redirect(new URL(destination, canonicalOrigin));
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}
