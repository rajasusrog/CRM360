import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sessionDestination } from "@/lib/auth-routing";

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

export async function getSession() {
  const supabase = await createClient();
  const empty = { supabase, user: null, profile: null, firm: null, client: null, issue: null as string | null };
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) {
      if (authError.name === "AuthSessionMissingError" || authError.status === 400 || authError.status === 401 || authError.status === 403) return empty;
      console.error("Session lookup failed", { stage: "auth", code: authError.code });
      return { ...empty, issue: "auth_unavailable" };
    }
    if (!user) return empty;

    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (profileError) {
      console.error("Session lookup failed", { stage: "profile", code: profileError.code });
      return { ...empty, user, issue: "profile_unavailable" };
    }
    if (profile) {
      const { data: firm, error: firmError } = await supabase.from("firms").select("*").eq("id", profile.firm_id).maybeSingle();
      if (firmError || !firm) console.error("Session lookup failed", { stage: "firm", code: firmError?.code ?? "not_visible" });
      return {
        supabase,
        user,
        profile: profile as Profile,
        firm: firm as Firm | null,
        client: null,
        issue: firmError || !firm ? "firm_unavailable" : null,
      };
    }

    const { data: client, error: clientError } = await supabase.from("client_users").select("*").eq("id", user.id).maybeSingle();
    if (clientError) {
      console.error("Session lookup failed", { stage: "client", code: clientError.code });
      return { ...empty, user, issue: "membership_unavailable" };
    }
    if (client) {
      const { data: firm, error: firmError } = await supabase.from("firms").select("*").eq("id", client.firm_id).maybeSingle();
      if (firmError || !firm) console.error("Session lookup failed", { stage: "firm", code: firmError?.code ?? "not_visible" });
      return {
        supabase,
        user,
        profile: null,
        firm: firm as Firm | null,
        client: client as ClientUser,
        issue: firmError || !firm ? "firm_unavailable" : null,
      };
    }

    return { ...empty, user };
  } catch {
    console.error("Session lookup failed", { stage: "network" });
    return { ...empty, issue: "session_unavailable" };
  }
}

export async function requireStaff() {
  const session = await getSession();
  const destination = sessionDestination(session);
  if (destination !== "/dashboard") redirect(destination);
  if (!session.user || !session.profile || !session.firm) throw new Error("Incomplete staff session");
  return {
    supabase: session.supabase,
    user: session.user,
    profile: session.profile,
    firm: session.firm,
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
  const destination = sessionDestination(session);
  if (destination !== "/portal") redirect(destination);
  if (!session.user || !session.client || !session.firm) throw new Error("Incomplete portal session");
  return { supabase: session.supabase, user: session.user, client: session.client, firm: session.firm };
}
