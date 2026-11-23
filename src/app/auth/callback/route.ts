import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { resolveAuthDestination, resolveSessionFromClient, safeNextPath } from "@/lib/auth-routing";
import {
  AUTH_NEXT_COOKIE,
  CRM_SCHEMA,
  hasPkceVerifierCookie,
  supabaseCookieOptions,
  type CrmDatabase,
} from "@/lib/supabase/options";
import { getConfiguredAppOrigin, supabasePublicConfig } from "@/lib/supabase/public-env";

export const dynamic = "force-dynamic";

function loginRedirect(origin: string, message: string) {
  const login = new URL("/login", origin);
  login.searchParams.set("error", message.slice(0, 180));
  const response = NextResponse.redirect(login);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(AUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestOrigin = url.origin;
  const allowedOrigin = getConfiguredAppOrigin() || requestOrigin;
  const code = url.searchParams.get("code");
  const flowId = url.searchParams.get("sb_flow_id");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (oauthError) {
    return loginRedirect(requestOrigin, oauthError);
  }

  const rawNext = url.searchParams.get("next") ?? request.cookies.get(AUTH_NEXT_COOKIE)?.value ?? null;
  const validatedNext = safeNextPath(rawNext, allowedOrigin);

  const { url: supabaseUrl, key } = supabasePublicConfig();
  const effectiveUrl = process.env.SUPABASE_INTERNAL_URL || supabaseUrl;
  if (!effectiveUrl || !key) {
    return loginRedirect(requestOrigin, "Sign-in is not configured on this deployment.");
  }

  const requestCookies = request.cookies.getAll();
  const hasVerifierCookie = hasPkceVerifierCookie(requestCookies);

  if (code && !hasVerifierCookie) {
    console.warn("[auth/callback] PKCE code received without verifier cookie", {
      hasCode: true,
      hasVerifierCookie: false,
      hasFlowId: Boolean(flowId),
      origin: requestOrigin,
    });
    return loginRedirect(
      requestOrigin,
      "Your sign-in session cookie did not reach the callback. Allow cookies for this site and sign in again from the same tab.",
    );
  }

  const cookieMap = new Map(requestCookies.map((cookie) => [cookie.name, cookie.value]));
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
      const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (error) return loginRedirect(requestOrigin, error.message);
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "email" | "magiclink" | "signup" | "invite" | "recovery",
      });
      if (error) return loginRedirect(requestOrigin, error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in could not be completed.";
    return loginRedirect(requestOrigin, message);
  }

  const session = await resolveSessionFromClient(supabase, true);
  const destination = resolveAuthDestination(session, {
    requestedNext: validatedNext,
    allowedOrigin,
  });

  const response = NextResponse.redirect(new URL(destination, requestOrigin));
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(AUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}
