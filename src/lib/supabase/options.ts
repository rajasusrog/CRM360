/** Isolated Supabase schema and storage bucket for the CRM application. */
export const CRM_SCHEMA = "crmpro" as const;
export const CRM_STORAGE_BUCKET = "crmpro_documents" as const;

/** Shared untyped database generic matching Supabase's default while scoping queries to CRM_SCHEMA. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CrmDatabase = any;

/**
 * Shared cookie options so browser and server clients read/write the exact same
 * host-only cookies without broadening across subdomains.
 * httpOnly must stay false so createBrowserClient can write the PKCE verifier.
 */
export const supabaseCookieOptions = {
  name: "sb-unikorn360-auth",
  path: "/",
  sameSite: "lax" as const,
  httpOnly: false,
};

export const AUTH_NEXT_COOKIE = "sb-unikorn360-next";

export function isPkceVerifierCookieName(name: string): boolean {
  const prefix = supabaseCookieOptions.name;
  const base = name.replace(/\.\d+$/, "");
  return (
    base === `${prefix}-code-verifier` ||
    (base.startsWith(`${prefix}-flow-`) && base.endsWith("-code-verifier"))
  );
}

/** Checks presence of a non-empty PKCE verifier cookie without exposing its value. */
export function hasPkceVerifierCookie(cookies: ReadonlyArray<{ name: string; value?: string }>): boolean {
  return cookies.some((cookie) => isPkceVerifierCookieName(cookie.name) && Boolean(cookie.value));
}
