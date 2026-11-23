import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { CRM_SCHEMA, CrmDatabase } from "@/lib/supabase/options";

export type CrmSupabaseClient = SupabaseClient<CrmDatabase, typeof CRM_SCHEMA>;

export type Firm = {
  id: string;
  name: string;
  city: string | null;
  state_code: string;
  address: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  pan: string | null;
  sac_code: string;
  plan: "starter" | "growth" | "pro";
  subscription_status: "trialing" | "active" | "past_due" | "cancelled";
  trial_ends_at: string | null;
  razorpay_subscription_id: string | null;
};

export type Profile = {
  id: string;
  firm_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: "owner" | "partner" | "staff" | "readonly";
};

export type ClientUser = {
  id: string;
  firm_id: string;
  account_id: string;
  contact_id: string | null;
};

export type SessionIssueCode =
  | "supabase_unconfigured"
  | "auth_lookup_failed"
  | "membership_lookup_failed"
  | "firm_lookup_failed"
  | "missing_firm";

export type SessionIssue = {
  code: SessionIssueCode;
  message: string;
  detail?: string;
};

export type SessionState =
  | "unauthenticated"
  | "no_membership"
  | "staff"
  | "client"
  | "invalid_membership"
  | "lookup_failed";

export type SessionResult = {
  supabase: CrmSupabaseClient;
  state: SessionState;
  user: User | null;
  profile: Profile | null;
  firm: Firm | null;
  client: ClientUser | null;
  issue: SessionIssue | null;
};

const AUTH_LOOP_PREFIXES = ["/login", "/signup", "/auth/callback", "/auth/recovery"];

function isAuthLoopPath(path: string): boolean {
  const pathname = path.split("?")[0]?.split("#")[0] ?? path;
  return AUTH_LOOP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Validates a post-authentication redirect target.
 * Accepts relative paths (rejecting protocol-relative `//` and backslashes)
 * or same-origin URLs when `allowedOrigin` is provided.
 */
export function safeNextPath(raw: string | null | undefined, allowedOrigin?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(trimmed)) return null;

  let normalizedPath: string | null = null;
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) return null;
    try {
      const parsed = new URL(trimmed, "https://app.local");
      if (parsed.origin !== "https://app.local") return null;
      normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  } else if (allowedOrigin) {
    try {
      const parsed = new URL(trimmed);
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.origin === allowedOrigin) {
        normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      return null;
    }
  }

  if (!normalizedPath || isAuthLoopPath(normalizedPath)) return null;
  return normalizedPath;
}

/**
 * Single shared server-side destination decision used by route guards,
 * auth callbacks, login/signup transitions, onboarding, and recovery.
 */
export function resolveAuthDestination(
  session: Pick<SessionResult, "state" | "issue" | "user" | "profile" | "client" | "firm">,
  options?: { requestedNext?: string | null; allowedOrigin?: string | null },
): string {
  const requested = safeNextPath(options?.requestedNext, options?.allowedOrigin);

  switch (session.state) {
    case "unauthenticated": {
      if (requested && requested !== "/") {
        return `/login?next=${encodeURIComponent(requested)}`;
      }
      return "/login";
    }
    case "lookup_failed":
    case "invalid_membership": {
      return "/auth/recovery";
    }
    case "no_membership": {
      if (requested && (requested.startsWith("/join/") || requested.startsWith("/portal/join/"))) {
        return requested;
      }
      return "/onboarding";
    }
    case "staff": {
      if (
        requested &&
        requested !== "/onboarding" &&
        !requested.startsWith("/onboarding?") &&
        requested !== "/portal" &&
        !requested.startsWith("/portal/") &&
        !requested.startsWith("/join/")
      ) {
        return requested;
      }
      return "/dashboard";
    }
    case "client": {
      if (
        requested &&
        (requested === "/portal" || requested.startsWith("/portal/")) &&
        !requested.startsWith("/portal/join/")
      ) {
        return requested;
      }
      return "/portal";
    }
  }
}

function isExpectedUnauthenticatedAuthError(error: { name?: string; status?: number; message?: string }): boolean {
  if (error.name === "AuthSessionMissingError") return true;
  if (typeof error.status === "number" && error.status >= 400 && error.status < 500) return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("session missing") || msg.includes("jwt") || msg.includes("invalid token");
}

export async function resolveSessionFromClient(
  supabase: CrmSupabaseClient,
  configured = true,
): Promise<SessionResult> {
  if (!configured) {
    return {
      supabase,
      state: "unauthenticated",
      user: null,
      profile: null,
      firm: null,
      client: null,
      issue: {
        code: "supabase_unconfigured",
        message: "Sign-in is not configured on this deployment.",
      },
    };
  }

  let user: User | null = null;
  try {
    const authRes = await supabase.auth.getUser();
    if (authRes.error && !isExpectedUnauthenticatedAuthError(authRes.error)) {
      return {
        supabase,
        state: "lookup_failed",
        user: null,
        profile: null,
        firm: null,
        client: null,
        issue: {
          code: "auth_lookup_failed",
          message: "Could not verify your authentication session.",
          detail: authRes.error.message,
        },
      };
    }
    user = authRes.data.user ?? null;
  } catch (error) {
    return {
      supabase,
      state: "lookup_failed",
      user: null,
      profile: null,
      firm: null,
      client: null,
      issue: {
        code: "auth_lookup_failed",
        message: "Could not reach authentication service.",
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }

  if (!user) {
    return {
      supabase,
      state: "unauthenticated",
      user: null,
      profile: null,
      firm: null,
      client: null,
      issue: null,
    };
  }

  try {
    const [profileRes, clientRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("client_users").select("*").eq("id", user.id).maybeSingle(),
    ]);

    if (profileRes.error || clientRes.error) {
      return {
        supabase,
        state: "lookup_failed",
        user,
        profile: null,
        firm: null,
        client: null,
        issue: {
          code: "membership_lookup_failed",
          message: "Could not verify your CRM membership.",
          detail: profileRes.error?.message || clientRes.error?.message,
        },
      };
    }

    const profile = (profileRes.data as Profile | null) ?? null;
    if (profile) {
      const firmRes = await supabase.from("firms").select("*").eq("id", profile.firm_id).maybeSingle();
      if (firmRes.error) {
        return {
          supabase,
          state: "lookup_failed",
          user,
          profile,
          firm: null,
          client: null,
          issue: {
            code: "firm_lookup_failed",
            message: "Could not load your firm workspace.",
            detail: firmRes.error.message,
          },
        };
      }
      if (!firmRes.data) {
        return {
          supabase,
          state: "invalid_membership",
          user,
          profile,
          firm: null,
          client: null,
          issue: {
            code: "missing_firm",
            message: "Your staff profile references a firm that was not found.",
          },
        };
      }
      return {
        supabase,
        state: "staff",
        user,
        profile,
        firm: firmRes.data as Firm,
        client: null,
        issue: null,
      };
    }

    const client = (clientRes.data as ClientUser | null) ?? null;
    if (client) {
      const firmRes = await supabase.from("firms").select("*").eq("id", client.firm_id).maybeSingle();
      if (firmRes.error) {
        return {
          supabase,
          state: "lookup_failed",
          user,
          profile: null,
          firm: null,
          client,
          issue: {
            code: "firm_lookup_failed",
            message: "Could not load the practice workspace for your portal account.",
            detail: firmRes.error.message,
          },
        };
      }
      if (!firmRes.data) {
        return {
          supabase,
          state: "invalid_membership",
          user,
          profile: null,
          firm: null,
          client,
          issue: {
            code: "missing_firm",
            message: "Your portal account references a firm that was not found.",
          },
        };
      }
      return {
        supabase,
        state: "client",
        user,
        profile: null,
        firm: firmRes.data as Firm,
        client,
        issue: null,
      };
    }

    return {
      supabase,
      state: "no_membership",
      user,
      profile: null,
      firm: null,
      client: null,
      issue: null,
    };
  } catch (error) {
    return {
      supabase,
      state: "lookup_failed",
      user,
      profile: null,
      firm: null,
      client: null,
      issue: {
        code: "membership_lookup_failed",
        message: "Database lookup failed while checking CRM membership.",
        detail: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
