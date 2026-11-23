import "server-only";
import { redirect } from "next/navigation";
import {
  resolveAuthDestination,
  resolveSessionFromClient,
  safeNextPath,
  type ClientUser,
  type CrmSupabaseClient,
  type Firm,
  type Profile,
  type SessionIssue,
  type SessionIssueCode,
  type SessionResult,
  type SessionState,
} from "@/lib/auth-routing";
import { supabasePublicConfig } from "@/lib/supabase/public-env";
import { createClient } from "@/lib/supabase/server";

export type {
  ClientUser,
  CrmSupabaseClient,
  Firm,
  Profile,
  SessionIssue,
  SessionIssueCode,
  SessionResult,
  SessionState,
};
export { resolveAuthDestination, resolveSessionFromClient, safeNextPath };

export async function getSession(): Promise<SessionResult> {
  const pub = supabasePublicConfig();
  if (!pub.configured && !process.env.SUPABASE_INTERNAL_URL) {
    return resolveSessionFromClient(null as unknown as CrmSupabaseClient, false);
  }
  const supabase = await createClient();
  return resolveSessionFromClient(supabase, true);
}

export async function requireStaff() {
  const session = await getSession();
  if (
    session.state !== "staff" ||
    !session.user ||
    !session.profile ||
    !session.firm ||
    session.profile.firm_id !== session.firm.id ||
    session.issue
  ) {
    redirect(resolveAuthDestination(session));
  }
  return {
    supabase: session.supabase,
    user: session.user,
    profile: session.profile,
    firm: session.firm,
    issue: null,
  };
}

export async function requireWriter() {
  const session = await requireStaff();
  if (session.profile.role === "readonly") {
    return { ...session, error: "Your role is read-only." as string | null };
  }
  return { ...session, error: null };
}

export async function requireOwner() {
  const session = await requireStaff();
  if (session.profile.role !== "owner") {
    return { ...session, error: "Only the firm owner can do that." as string | null };
  }
  return { ...session, error: null };
}

export async function requireClient() {
  const session = await getSession();
  if (
    session.state !== "client" ||
    !session.user ||
    !session.client ||
    !session.firm ||
    session.client.firm_id !== session.firm.id ||
    session.issue
  ) {
    redirect(resolveAuthDestination(session, { requestedNext: "/portal" }));
  }
  return {
    supabase: session.supabase,
    user: session.user,
    client: session.client,
    firm: session.firm,
    issue: null,
  };
}
