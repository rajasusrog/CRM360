"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isLocale, type Locale } from "@/lib/i18n";
import { validateGstin } from "@/lib/gst/gstin";
import { normalizeIndianMobile } from "@/lib/format";
import { getSession, requireStaff, resolveAuthDestination } from "@/lib/session";
import { CRM_SCHEMA } from "@/lib/supabase/options";
import { getConfiguredAppOrigin, supabasePublicConfig } from "@/lib/supabase/public-env";

export async function signOut() {
  const pub = supabasePublicConfig();
  if (pub.configured || process.env.SUPABASE_INTERNAL_URL) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function resolvePostAuthDestination(nextPath?: string | null) {
  const session = await getSession();
  return {
    destination: resolveAuthDestination(session, {
      requestedNext: nextPath,
      allowedOrigin: getConfiguredAppOrigin(),
    }),
  };
}

export async function retrySessionRecovery() {
  const session = await getSession();
  if (session.state !== "lookup_failed" && session.state !== "invalid_membership") {
    redirect(resolveAuthDestination(session));
  }
  revalidatePath("/auth/recovery");
}

export async function createFirm(formData: FormData) {
  const session = await getSession();
  if (session.state === "unauthenticated") redirect("/login");
  if (session.state !== "no_membership") {
    redirect(resolveAuthDestination(session));
  }

  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const stateCode = String(formData.get("state_code") ?? "33").trim();
  const gstinRaw = String(formData.get("gstin") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  if (name.length < 2) return { error: "Firm name is required." };
  if (gstinRaw) {
    const gstin = validateGstin(gstinRaw);
    if (!gstin.ok) return { error: gstin.reason };
  }
  if (phoneRaw && !normalizeIndianMobile(phoneRaw)) return { error: "Enter a 10-digit Indian mobile." };

  const { error } = await session.supabase.schema(CRM_SCHEMA).rpc("crmpro_create_firm", {
    p_name: name,
    p_city: city,
    p_state_code: stateCode,
    p_gstin: gstinRaw,
    p_phone: phoneRaw ? normalizeIndianMobile(phoneRaw) : "",
  });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function acceptInvite(token: string) {
  const session = await getSession();
  if (session.state === "unauthenticated") redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  if (session.state !== "no_membership") {
    redirect(resolveAuthDestination(session));
  }
  const { error } = await session.supabase.schema(CRM_SCHEMA).rpc("crmpro_accept_invite", { p_token: token });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function acceptPortalInvite(token: string) {
  const session = await getSession();
  if (session.state === "unauthenticated") redirect(`/login?next=${encodeURIComponent(`/portal/join/${token}`)}`);
  if (session.state !== "no_membership") {
    redirect(resolveAuthDestination(session));
  }
  const { error } = await session.supabase.schema(CRM_SCHEMA).rpc("crmpro_accept_portal_invite", { p_token: token });
  if (error) return { error: error.message };
  redirect("/portal");
}

export async function updateProfile(formData: FormData) {
  const session = await requireStaff();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  if (!fullName) return { error: "Name is required." };
  const phone = phoneRaw ? normalizeIndianMobile(phoneRaw) : null;
  if (phoneRaw && !phone) return { error: "Enter a 10-digit Indian mobile." };
  const { error } = await session.supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", session.profile.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
}
