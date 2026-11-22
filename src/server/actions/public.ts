"use server";

import { createAdmin } from "@/lib/supabase/admin";
import { normalizeIndianMobile } from "@/lib/format";
import { runWorkflows } from "@/server/workflow-run";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function submitWebLead(formData: FormData) {
  if (text(formData, "company_website")) return { ok: "Thank you." };
  if (formData.get("consent") !== "on") return { error: "Consent is required before we store this enquiry." };
  const first = text(formData, "first_name");
  if (!first) return { error: "Name is required." };
  const phoneRaw = text(formData, "phone");
  const phone = phoneRaw ? normalizeIndianMobile(phoneRaw) : null;
  if (phoneRaw && !phone) return { error: "Enter a 10-digit Indian mobile." };
  const admin = createAdmin();
  const { data: form } = await admin.from("web_forms").select("*").eq("public_key", text(formData, "public_key")).eq("active", true).maybeSingle();
  if (!form) return { error: "This form is closed." };
  const { data, error } = await admin
    .from("leads")
    .insert({
      firm_id: form.firm_id,
      first_name: first,
      last_name: text(formData, "last_name") || null,
      company: text(formData, "company") || null,
      email: text(formData, "email") || null,
      phone,
      city: text(formData, "city") || null,
      notes: text(formData, "notes") || null,
      source: form.default_source || "web-form",
      owner_id: form.default_owner_id,
      web_form_id: form.id,
      consent_data_processing: true,
      consent_purpose: "Website enquiry",
      consent_at: new Date().toISOString(),
    })
    .select("id, first_name, last_name, company")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save the enquiry." };
  await runWorkflows(admin, "lead.created", {
    firmId: form.firm_id,
    actorId: form.default_owner_id,
    leadId: data.id,
    relatedType: "lead",
    relatedId: data.id,
    link: `/leads/${data.id}`,
    vars: { lead_name: `${data.first_name} ${data.last_name ?? ""}`.trim(), company: data.company ?? "" },
  });
  return { ok: "Thank you. Someone from the firm will call you." };
}
