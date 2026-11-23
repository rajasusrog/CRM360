import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_NEXT_COOKIE,
  hasPkceVerifierCookie,
  isPkceVerifierCookieName,
  supabaseCookieOptions,
} from "@/lib/supabase/options";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { updateSession } from "@/lib/supabase/proxy";
import { GET as callbackGet } from "@/app/auth/callback/route";
import { getConfiguredAppOrigin, isLocalOrPreviewHost } from "@/lib/supabase/public-env";

function makeInMemoryCookieJar() {
  const store = new Map<string, { value: string; attrs: string }>();
  return {
    get cookieHeader() {
      return Array.from(store.entries())
        .map(([k, v]) => `${k}=${v.value}`)
        .join("; ");
    },
    get rawEntries() {
      return Array.from(store.entries()).map(([name, entry]) => ({ name, ...entry }));
    },
    writeSetCookieString(raw: string) {
      const parts = raw.split(";").map((p) => p.trim());
      const [nv, ...attrParts] = parts;
      const eq = nv.indexOf("=");
      if (eq === -1) return;
      const name = nv.slice(0, eq).trim();
      const value = nv.slice(eq + 1).trim();
      const attrs = attrParts.join("; ");
      const maxAgeMatch = attrs.match(/Max-Age=0/i);
      if (maxAgeMatch || value === "") {
        store.delete(name);
      } else {
        store.set(name, { value, attrs });
      }
    },
    clear() {
      store.clear();
    },
  };
}

describe("PKCE cookie options, browser/server handoff, and proxy isolation", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalDocument = (globalThis as { document?: unknown }).document;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-ref.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-public-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://crm360.unikorn360.com";
    delete process.env.SUPABASE_INTERNAL_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = originalWindow;
    if (originalDocument === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = originalDocument;
  });

  it("uses compatible host-only cookie options without broadening across subdomains", () => {
    expect(supabaseCookieOptions.name).toBe("sb-unikorn360-auth");
    expect(supabaseCookieOptions.path).toBe("/");
    expect(supabaseCookieOptions.sameSite).toBe("lax");
    expect(supabaseCookieOptions.httpOnly).toBe(false);
    expect("domain" in supabaseCookieOptions).toBe(false);
    expect(getConfiguredAppOrigin()).toBe("https://crm360.unikorn360.com");
    expect(isLocalOrPreviewHost("crm360.unikorn360.com")).toBe(false);
    expect(isLocalOrPreviewHost("127.0.0.1")).toBe(true);
    expect(isLocalOrPreviewHost("localhost")).toBe(true);
  });

  it("recognizes PKCE verifier cookie names and checks presence without exposing values", () => {
    expect(isPkceVerifierCookieName("sb-unikorn360-auth-code-verifier")).toBe(true);
    expect(isPkceVerifierCookieName("sb-unikorn360-auth-flow-abcdef123456-code-verifier")).toBe(true);
    expect(isPkceVerifierCookieName("sb-unikorn360-auth-code-verifier.0")).toBe(true);
    expect(isPkceVerifierCookieName("sb-unikorn360-auth")).toBe(false);

    expect(hasPkceVerifierCookie([{ name: "sb-unikorn360-auth-code-verifier", value: "" }])).toBe(false);
    expect(hasPkceVerifierCookie([{ name: "sb-unikorn360-auth-code-verifier", value: "present" }])).toBe(true);
  });

  it("creates PKCE verifier cookie before OAuth redirect and exchanges code once on /auth/callback", async () => {
    const jar = makeInMemoryCookieJar();
    const doc = {
      get cookie() {
        return jar.cookieHeader;
      },
      set cookie(val: string) {
        jar.writeSetCookieString(val);
      },
    };
    (globalThis as { document?: unknown }).document = doc;
    (globalThis as { window?: unknown }).window = {
      document: doc,
      location: { origin: "https://crm360.unikorn360.com", href: "https://crm360.unikorn360.com/login" },
    };

    const tokenExchanges: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/auth/v1/token?grant_type=pkce")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        tokenExchanges.push({ url, body });
        return new Response(
          JSON.stringify({
            access_token: "access-token-123",
            token_type: "bearer",
            expires_in: 3600,
            refresh_token: "refresh-token-123",
            user: {
              id: "user-1",
              aud: "authenticated",
              email: "partner@firm.test",
              app_metadata: {},
              user_metadata: {},
              created_at: "2026-01-01T00:00:00.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/auth/v1/user")) {
        return new Response(
          JSON.stringify({
            id: "user-1",
            aud: "authenticated",
            email: "partner@firm.test",
            app_metadata: {},
            user_metadata: {},
            created_at: "2026-01-01T00:00:00.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/rest/v1/profiles")) {
        return new Response(
          JSON.stringify({
            id: "user-1",
            firm_id: "firm-1",
            full_name: "Partner",
            email: "partner@firm.test",
            phone: null,
            role: "owner",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/rest/v1/client_users")) {
        return new Response(JSON.stringify(null), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/rest/v1/firms")) {
        return new Response(
          JSON.stringify({
            id: "firm-1",
            name: "Kaveri & Co.",
            city: "Chennai",
            state_code: "33",
            address: null,
            pincode: null,
            phone: null,
            email: "office@firm.test",
            gstin: null,
            pan: null,
            sac_code: "998222",
            plan: "growth",
            subscription_status: "active",
            trial_ends_at: null,
            razorpay_subscription_id: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch URL in pkce.test.ts: ${url}`);
    }) as typeof fetch;

    // Step 1: Browser initiates Google PKCE without immediate redirect
    const browserA = createBrowserSupabase();
    const browserB = createBrowserSupabase();
    expect(browserA).toBe(browserB); // isSingleton: true

    const { data, error } = await browserA.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://crm360.unikorn360.com/auth/callback",
        skipBrowserRedirect: true,
      },
    });
    expect(error).toBeNull();
    expect(data.url).toContain("code_challenge=");
    expect(data.url).toContain("redirect_to=https%3A%2F%2Fcrm360.unikorn360.com%2Fauth%2Fcallback");

    // Step 2: Verifier cookie is present, Path=/, SameSite=Lax, and host-only (no Domain=)
    const verifierEntries = jar.rawEntries.filter((entry) => isPkceVerifierCookieName(entry.name));
    expect(verifierEntries.length).toBeGreaterThan(0);
    for (const entry of verifierEntries) {
      expect(entry.attrs).toContain("Path=/");
      expect(entry.attrs).toMatch(/SameSite=Lax/i);
      expect(entry.attrs).not.toMatch(/Domain=/i);
    }

    // Step 3: Switch to pure server runtime; proxy bypasses /auth/callback and leaves verifier intact
    if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = originalWindow;
    if (originalDocument === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = originalDocument;

    const callbackReq = new NextRequest("https://crm360.unikorn360.com/auth/callback?code=auth-code-xyz", {
      headers: {
        cookie: `${jar.cookieHeader}; sb-unikorn360-auth=stale-invalid-session; ${AUTH_NEXT_COOKIE}=${encodeURIComponent("/deals")}`,
      },
    });
    const proxyRes = await updateSession(callbackReq);
    expect(proxyRes.headers.get("set-cookie")).toBeNull();

    // Step 4: Callback exchanges code exactly once on the server and routes to validated next destination
    const response = await callbackGet(callbackReq);
    expect(tokenExchanges).toHaveLength(1);
    expect(tokenExchanges[0].body.auth_code).toBe("auth-code-xyz");
    expect(typeof tokenExchanges[0].body.code_verifier).toBe("string");
    expect((tokenExchanges[0].body.code_verifier as string).length).toBeGreaterThan(20);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://crm360.unikorn360.com/deals");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects /auth/callback?code=... cleanly when verifier cookie never reached callback", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const req = new NextRequest("https://crm360.unikorn360.com/auth/callback?code=auth-code-missing-cookie");
    const response = await callbackGet(req);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toContain("https://crm360.unikorn360.com/login?error=");
  });
});
