import { redirect } from "next/navigation";
import { supabasePublicConfig } from "@/lib/supabase/public-env";
import { createClient } from "@/lib/supabase/server";

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
  const pub = supabasePublicConfig();
  if (!pub.configured && !process.env.SUPABASE_INTERNAL_URL) {
    return {
      supabase: null as unknown as Awaited<ReturnType<typeof createClient>>,
      user: null,
      profile: null,
      firm: null,
      client: null,
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, firm: null, client: null };

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (profile) {
    const { data: firm } = await supabase.from("firms").select("*").eq("id", profile.firm_id).maybeSingle();
    return {
      supabase,
      user,
      profile: profile as Profile,
      firm: firm as Firm | null,
      client: null,
    };
  }

  const { data: client } = await supabase.from("client_users").select("*").eq("id", user.id).maybeSingle();
  if (client) {
    const { data: firm } = await supabase.from("firms").select("*").eq("id", client.firm_id).maybeSingle();
    return {
      supabase,
      user,
      profile: null,
      firm: firm as Firm | null,
      client: client as ClientUser,
    };
  }

  return { supabase, user, profile: null, firm: null, client: null };
}

export async function requireStaff() {
  const session = await getSession();
  if (!session.user) redirect("/login");
  if (session.client) redirect("/portal");
  if (!session.profile || !session.firm) redirect("/onboarding");
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
  if (!session.user) redirect("/login?next=/portal");
  if (!session.client || !session.firm) redirect("/dashboard");
  return { supabase: session.supabase, user: session.user, client: session.client, firm: session.firm };
}
