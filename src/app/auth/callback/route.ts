import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseCookieOptions } from "@/lib/supabase/options";
import { supabasePublicConfig } from "@/lib/supabase/public-env";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function loginRedirect(origin: string, message: string) {
  const login = new URL("/login", origin);
  login.searchParams.set("error", message.slice(0, 180));
  return NextResponse.redirect(login);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const destination = new URL(safeNext(url.searchParams.get("next")), url.origin);
  let response = NextResponse.redirect(destination);
  const { url: supabaseUrl, key } = supabasePublicConfig();
  if (!supabaseUrl || !key) return loginRedirect(url.origin, "Sign-in is not configured on this deployment.");

  const supabase = createServerClient(supabaseUrl, key, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return loginRedirect(url.origin, error.message);
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "email" | "magiclink" | "signup" | "invite" | "recovery",
      });
      if (error) return loginRedirect(url.origin, error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in could not be completed.";
    return loginRedirect(url.origin, message);
  }

  return response;
}
