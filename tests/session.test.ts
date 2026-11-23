import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CrmSupabaseClient, Firm, Profile, ClientUser } from "@/lib/auth-routing";

class RedirectSignal extends Error {
  readonly location: string;
  constructor(location: string) {
    super(`NEXT_REDIRECT:${location}`);
    this.location = location;
  }
}

const mockCreateClient = vi.fn();
const mockSupabasePublicConfig = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    throw new RedirectSignal(location);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock("@/lib/supabase/public-env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase/public-env")>("@/lib/supabase/public-env");
  return {
    ...actual,
    supabasePublicConfig: () => mockSupabasePublicConfig(),
  };
});

import {
  getSession,
  requireClient,
  requireStaff,
  resolveAuthDestination,
  safeNextPath,
} from "@/lib/session";
import { GET as continueGet } from "@/app/auth/continue/route";

const DEMO_USER: User = {
  id: "user-1",
  email: "staff@kaveri.test",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00.000Z",
};

const DEMO_FIRM: Firm = {
  id: "firm-1",
  name: "Kaveri & Co.",
  city: "Chennai",
  state_code: "33",
  address: null,
  pincode: null,
  phone: null,
  email: "office@kaveri.test",
  gstin: null,
  pan: null,
  sac_code: "998222",
  plan: "growth",
  subscription_status: "trialing",
  trial_ends_at: null,
  razorpay_subscription_id: null,
};

const DEMO_PROFILE: Profile = {
  id: "user-1",
  firm_id: "firm-1",
  full_name: "Rajesh Iyer",
  email: "staff@kaveri.test",
  phone: null,
  role: "owner",
};

const DEMO_CLIENT: ClientUser = {
  id: "user-1",
  firm_id: "firm-1",
  account_id: "account-1",
  contact_id: null,
};

type TableResponse = { data: unknown; error: { message: string } | null };

function makeMockSupabase(options: {
  getUser?: () => Promise<{ data: { user: typeof DEMO_USER | null }; error: { name?: string; status?: number; message: string } | null }>;
  tables?: Partial<Record<"profiles" | "client_users" | "firms", TableResponse | (() => Promise<TableResponse>)>>;
}): CrmSupabaseClient {
  const tables = options.tables ?? {};
  return {
    auth: {
      getUser:
        options.getUser ??
        (async () => ({
          data: { user: DEMO_USER },
          error: null,
        })),
    },
    from: (table: "profiles" | "client_users" | "firms") => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            const handler = tables[table];
            if (!handler) return { data: null, error: null };
            return typeof handler === "function" ? handler() : handler;
          },
        }),
      }),
    }),
  } as unknown as CrmSupabaseClient;
}

describe("getSession and auth routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabasePublicConfig.mockReturnValue({
      url: "https://example.supabase.co",
      key: "anon-key",
      configured: true,
    });
  });

  it("reports supabase_unconfigured cleanly without masking as onboarding", async () => {
    const prevInternal = process.env.SUPABASE_INTERNAL_URL;
    delete process.env.SUPABASE_INTERNAL_URL;
    mockSupabasePublicConfig.mockReturnValue({ url: "", key: "", configured: false });

    const session = await getSession();
    expect(session.state).toBe("unauthenticated");
    expect(session.user).toBeNull();
    expect(session.issue?.code).toBe("supabase_unconfigured");
    expect(resolveAuthDestination(session)).toBe("/login");

    if (prevInternal !== undefined) process.env.SUPABASE_INTERNAL_URL = prevInternal;
  });

  it("returns unauthenticated with issue: null when no user is signed in", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        getUser: async () => ({
          data: { user: null },
          error: { name: "AuthSessionMissingError", status: 400, message: "Auth session missing!" },
        }),
      }),
    );

    const session = await getSession();
    expect(session.state).toBe("unauthenticated");
    expect(session.user).toBeNull();
    expect(session.profile).toBeNull();
    expect(session.firm).toBeNull();
    expect(session.client).toBeNull();
    expect(session.issue).toBeNull();
    expect(resolveAuthDestination(session)).toBe("/login");
    expect(resolveAuthDestination(session, { requestedNext: "/deals" })).toBe("/login?next=%2Fdeals");
  });

  it("returns no_membership for an authenticated user without profile or client_user", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: null, error: null },
          client_users: { data: null, error: null },
        },
      }),
    );

    const session = await getSession();
    expect(session.state).toBe("no_membership");
    expect(session.user?.id).toBe(DEMO_USER.id);
    expect(session.issue).toBeNull();
    expect(resolveAuthDestination(session)).toBe("/onboarding");
    expect(resolveAuthDestination(session, { requestedNext: "/join/abc123" })).toBe("/join/abc123");
    expect(resolveAuthDestination(session, { requestedNext: "/portal/join/p123" })).toBe("/portal/join/p123");
  });

  it("returns valid staff membership and firm, ignoring portal/onboarding next redirects", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: DEMO_PROFILE, error: null },
          client_users: { data: null, error: null },
          firms: { data: DEMO_FIRM, error: null },
        },
      }),
    );

    const session = await getSession();
    expect(session.state).toBe("staff");
    expect(session.profile?.id).toBe(DEMO_PROFILE.id);
    expect(session.firm?.id).toBe(DEMO_FIRM.id);
    expect(session.client).toBeNull();
    expect(session.issue).toBeNull();

    expect(resolveAuthDestination(session)).toBe("/dashboard");
    expect(resolveAuthDestination(session, { requestedNext: "/deals" })).toBe("/deals");
    expect(resolveAuthDestination(session, { requestedNext: "/onboarding" })).toBe("/dashboard");
    expect(resolveAuthDestination(session, { requestedNext: "/portal" })).toBe("/dashboard");
    expect(resolveAuthDestination(session, { requestedNext: "/portal/invoices" })).toBe("/dashboard");
  });

  it("returns valid client membership and firm, blocking staff/onboarding destinations", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: null, error: null },
          client_users: { data: DEMO_CLIENT, error: null },
          firms: { data: DEMO_FIRM, error: null },
        },
      }),
    );

    const session = await getSession();
    expect(session.state).toBe("client");
    expect(session.client?.account_id).toBe(DEMO_CLIENT.account_id);
    expect(session.firm?.id).toBe(DEMO_FIRM.id);
    expect(session.profile).toBeNull();
    expect(session.issue).toBeNull();

    expect(resolveAuthDestination(session)).toBe("/portal");
    expect(resolveAuthDestination(session, { requestedNext: "/portal/filings" })).toBe("/portal/filings");
    expect(resolveAuthDestination(session, { requestedNext: "/dashboard" })).toBe("/portal");
    expect(resolveAuthDestination(session, { requestedNext: "/onboarding" })).toBe("/portal");
  });

  it("returns invalid_membership with missing_firm and routes to /auth/recovery (not /onboarding)", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: DEMO_PROFILE, error: null },
          client_users: { data: null, error: null },
          firms: { data: null, error: null },
        },
      }),
    );

    const session = await getSession();
    expect(session.state).toBe("invalid_membership");
    expect(session.firm).toBeNull();
    expect(session.issue?.code).toBe("missing_firm");
    expect(resolveAuthDestination(session)).toBe("/auth/recovery");
  });

  it("returns lookup_failed on membership DB failure and never redirects to /onboarding", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: null, error: { message: "permission denied for schema crmpro" } },
          client_users: { data: null, error: null },
        },
      }),
    );

    const session = await getSession();
    expect(session.state).toBe("lookup_failed");
    expect(session.issue?.code).toBe("membership_lookup_failed");
    expect(session.issue?.detail).toContain("permission denied");
    expect(resolveAuthDestination(session)).toBe("/auth/recovery");
  });

  it("returns lookup_failed on firm DB failure and never redirects to /onboarding", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: DEMO_PROFILE, error: null },
          client_users: { data: null, error: null },
          firms: { data: null, error: { message: "upstream timeout" } },
        },
      }),
    );

    const session = await getSession();
    expect(session.state).toBe("lookup_failed");
    expect(session.issue?.code).toBe("firm_lookup_failed");
    expect(resolveAuthDestination(session)).toBe("/auth/recovery");
  });

  it("returns lookup_failed when auth verification errors unexpectedly", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        getUser: async () => ({
          data: { user: null },
          error: { name: "AuthRetryableFetchError", status: 503, message: "Service unavailable" },
        }),
      }),
    );

    const session = await getSession();
    expect(session.state).toBe("lookup_failed");
    expect(session.issue?.code).toBe("auth_lookup_failed");
    expect(resolveAuthDestination(session)).toBe("/auth/recovery");
  });

  it("rejects open redirects and auth-loop paths in safeNextPath", () => {
    expect(safeNextPath("https://evil.com/dashboard", "https://crmpro360.unikorn360.com")).toBeNull();
    expect(safeNextPath("//evil.com/dashboard", "https://crmpro360.unikorn360.com")).toBeNull();
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
    expect(safeNextPath("/login?next=/dashboard")).toBeNull();
    expect(safeNextPath("/auth/recovery")).toBeNull();
    expect(safeNextPath("/auth/callback?code=123")).toBeNull();
    expect(safeNextPath("https://crmpro360.unikorn360.com/deals?view=mine", "https://crmpro360.unikorn360.com")).toBe(
      "/deals?view=mine",
    );
    expect(safeNextPath("/clients/123")).toBe("/clients/123");
  });

  it("prevents cross-role and recovery redirect loops in requireStaff and requireClient", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: null, error: null },
          client_users: { data: DEMO_CLIENT, error: null },
          firms: { data: DEMO_FIRM, error: null },
        },
      }),
    );
    await expect(requireStaff()).rejects.toMatchObject({ location: "/portal" });

    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: DEMO_PROFILE, error: null },
          client_users: { data: null, error: null },
          firms: { data: DEMO_FIRM, error: null },
        },
      }),
    );
    await expect(requireClient()).rejects.toMatchObject({ location: "/dashboard" });

    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: null, error: { message: "db error" } },
          client_users: { data: null, error: null },
        },
      }),
    );
    await expect(requireStaff()).rejects.toMatchObject({ location: "/auth/recovery" });
    await expect(requireClient()).rejects.toMatchObject({ location: "/auth/recovery" });
  });
});

describe("GET /auth/continue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_APP_URL;
    mockSupabasePublicConfig.mockReturnValue({
      url: "https://example.supabase.co",
      key: "anon-key",
      configured: true,
    });
  });

  it("redirects unauthenticated callers to /login with Cache-Control: no-store", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        getUser: async () => ({
          data: { user: null },
          error: { name: "AuthSessionMissingError", status: 400, message: "Auth session missing!" },
        }),
      }),
    );

    const response = await continueGet(new NextRequest("https://crmpro360.unikorn360.com/auth/continue"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://crmpro360.unikorn360.com/login");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("redirects verified staff to /dashboard (or safe staff next) and rejects external/self-loop targets", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: DEMO_PROFILE, error: null },
          client_users: { data: null, error: null },
          firms: { data: DEMO_FIRM, error: null },
        },
      }),
    );

    const defaultRes = await continueGet(new NextRequest("https://crmpro360.unikorn360.com/auth/continue"));
    expect(defaultRes.headers.get("location")).toBe("https://crmpro360.unikorn360.com/dashboard");
    expect(defaultRes.headers.get("cache-control")).toBe("no-store");

    const nextRes = await continueGet(new NextRequest("https://crmpro360.unikorn360.com/auth/continue?next=/deals"));
    expect(nextRes.headers.get("location")).toBe("https://crmpro360.unikorn360.com/deals");
    expect(nextRes.headers.get("cache-control")).toBe("no-store");

    const evilRes = await continueGet(
      new NextRequest("https://crmpro360.unikorn360.com/auth/continue?next=https://evil.com/phish"),
    );
    expect(evilRes.headers.get("location")).toBe("https://crmpro360.unikorn360.com/dashboard");
    expect(evilRes.headers.get("cache-control")).toBe("no-store");

    const loopRes = await continueGet(
      new NextRequest("https://crmpro360.unikorn360.com/auth/continue?next=/auth/continue"),
    );
    expect(loopRes.headers.get("location")).toBe("https://crmpro360.unikorn360.com/dashboard");
  });

  it("redirects verified client users to /portal and no_membership users to /onboarding with no-store", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: null, error: null },
          client_users: { data: DEMO_CLIENT, error: null },
          firms: { data: DEMO_FIRM, error: null },
        },
      }),
    );

    const clientRes = await continueGet(new NextRequest("https://crmpro360.unikorn360.com/auth/continue?next=/dashboard"));
    expect(clientRes.headers.get("location")).toBe("https://crmpro360.unikorn360.com/portal");
    expect(clientRes.headers.get("cache-control")).toBe("no-store");

    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: null, error: null },
          client_users: { data: null, error: null },
        },
      }),
    );

    const onboardRes = await continueGet(new NextRequest("https://crmpro360.unikorn360.com/auth/continue"));
    expect(onboardRes.headers.get("location")).toBe("https://crmpro360.unikorn360.com/onboarding");
    expect(onboardRes.headers.get("cache-control")).toBe("no-store");
  });

  it("redirects lookup_failed and missing_firm to /auth/recovery with Cache-Control: no-store", async () => {
    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: null, error: { message: "schema crmpro lookup failed" } },
          client_users: { data: null, error: null },
        },
      }),
    );

    const failedRes = await continueGet(new NextRequest("https://crmpro360.unikorn360.com/auth/continue"));
    expect(failedRes.headers.get("location")).toBe("https://crmpro360.unikorn360.com/auth/recovery");
    expect(failedRes.headers.get("cache-control")).toBe("no-store");

    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: DEMO_PROFILE, error: null },
          client_users: { data: null, error: null },
          firms: { data: null, error: null },
        },
      }),
    );

    const missingFirmRes = await continueGet(new NextRequest("https://crmpro360.unikorn360.com/auth/continue"));
    expect(missingFirmRes.headers.get("location")).toBe("https://crmpro360.unikorn360.com/auth/recovery");
    expect(missingFirmRes.headers.get("cache-control")).toBe("no-store");
  });
});

describe("verified session routing invariants (consolidated from auth-routing)", () => {
  const baseSession = {
    state: "unauthenticated" as const,
    user: null,
    profile: null,
    client: null,
    firm: null,
    issue: null,
  };

  it("stops missing-firm staff and client sessions at /auth/recovery even if passed directly", () => {
    expect(
      resolveAuthDestination({
        ...baseSession,
        state: "staff",
        user: DEMO_USER,
        profile: DEMO_PROFILE,
        firm: null,
      }),
    ).toBe("/auth/recovery");

    expect(
      resolveAuthDestination({
        ...baseSession,
        state: "client",
        user: DEMO_USER,
        client: DEMO_CLIENT,
        firm: null,
      }),
    ).toBe("/auth/recovery");
  });

  it("rejects mismatched profile and client firm IDs both in resolveAuthDestination and getSession()", async () => {
    const otherFirm: Firm = { ...DEMO_FIRM, id: "firm-other" };

    expect(
      resolveAuthDestination({
        ...baseSession,
        state: "staff",
        user: DEMO_USER,
        profile: DEMO_PROFILE,
        firm: otherFirm,
      }),
    ).toBe("/auth/recovery");

    expect(
      resolveAuthDestination({
        ...baseSession,
        state: "client",
        user: DEMO_USER,
        client: DEMO_CLIENT,
        firm: otherFirm,
      }),
    ).toBe("/auth/recovery");

    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: DEMO_PROFILE, error: null },
          client_users: { data: null, error: null },
          firms: { data: otherFirm, error: null },
        },
      }),
    );
    const staffMismatch = await getSession();
    expect(staffMismatch.state).toBe("invalid_membership");
    expect(staffMismatch.issue?.code).toBe("missing_firm");
    expect(resolveAuthDestination(staffMismatch)).toBe("/auth/recovery");

    mockCreateClient.mockResolvedValue(
      makeMockSupabase({
        tables: {
          profiles: { data: null, error: null },
          client_users: { data: DEMO_CLIENT, error: null },
          firms: { data: otherFirm, error: null },
        },
      }),
    );
    const clientMismatch = await getSession();
    expect(clientMismatch.state).toBe("invalid_membership");
    expect(clientMismatch.issue?.code).toBe("missing_firm");
    expect(resolveAuthDestination(clientMismatch)).toBe("/auth/recovery");
  });

  it("never routes sessions carrying a database/lookup issue to onboarding", () => {
    expect(
      resolveAuthDestination({
        ...baseSession,
        state: "no_membership",
        user: DEMO_USER,
        issue: {
          code: "membership_lookup_failed",
          message: "Could not verify your CRM membership.",
        },
      }),
    ).toBe("/auth/recovery");
  });
});
