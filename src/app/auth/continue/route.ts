import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { resolveAuthDestination } from "@/lib/auth-routing";
import { getConfiguredAppOrigin } from "@/lib/supabase/public-env";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const canonicalOrigin = getConfiguredAppOrigin() || requestUrl.origin;
  const requestedNext = requestUrl.searchParams.get("next");

  const session = await getSession();
  const destination = resolveAuthDestination(session, {
    requestedNext,
    allowedOrigin: canonicalOrigin,
  });

  const response = NextResponse.redirect(new URL(destination, canonicalOrigin));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
