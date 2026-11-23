import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { sessionDestination } from "@/lib/auth-routing";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL(sessionDestination(await getSession()), request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
