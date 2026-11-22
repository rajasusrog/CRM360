"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { featuresFor } from "@/lib/plans";
import { validateGstin } from "@/lib/gst/gstin";
import { normalizeIndianMobile } from "@/lib/format";
import { rowsToObjects, parseCsv } from "@/lib/csv";
import { requireStaff, requireWriter } from "@/lib/session";
import { runWorkflows } from "@/server/workflow-run";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function phoneOrError(raw: string) {
  if (!raw) return { phone: null as string | null, error: null as string | null };
  const phone = normalizeIndianMobile(raw);
  if (!phone) return { phone: null, error: "Enter a 10-digit Indian mobile." };
  return { phone, error: null };
}

async function customPayload(formData: FormData, module: string, firmId: string, supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"]) {
  const { data: defs } = await supabase.from("custom_field_defs").select("key, field_type").eq("firm_id", firmId).eq("module", module);
  const payload: Record<string, string | number | boolean | null> = {};
  for (const def of defs ?? []) {
    const raw = text(formData, `cf_${def.key}`);
    if (!raw) {
      payload[def.key] = def.field_type === "boolean" ? false : null;
      continue;
    }
    if (def.field_type === "number") payload[def.key] = Number(raw);
    else if (def.field_type === "boolean") payload[def.key] = raw === "on" || raw === "true";
    else payload[def.key] = raw;
  }
  return payload;
}

export async function createLead(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const first = text(formData, "first_name");
  if (!first) return { error: "First name is required." };
  const phone = phoneOrError(text(formData, "phone"));
  if (phone.error) return { error: phone.error };
  const gstinRaw = text(formData, "gstin");
  if (gstinRaw && !validateGstin(gstinRaw).ok) return { error: validateGstin(gstinRaw).ok ? "" : (validateGstin(gstinRaw) as { reason: string }).reason };
  const consent = formData.get("consent_data_processing") === "on";
  const custom = await customPayload(formData, "lead", session.firm.id, session.supabase);
  const { data, error } = await session.supabase
    .from("leads")
    .insert({
      firm_id: session.firm.id,
      first_name: first,
      last_name: text(formData, "last_name") || null,
      email: text(formData, "email") || null,
      phone: phone.phone,
      company: text(formData, "company") || null,
      source: text(formData, "source") || "manual",
      status: "new",
      owner_id: text(formData, "owner_id") || session.profile.id,
      city: text(formData, "city") || null,
      notes: text(formData, "notes") || null,
      gstin: gstinRaw ? gstinRaw.toUpperCase() : null,
      consent_data_processing: consent,
      consent_marketing: formData.get("consent_marketing") === "on",
      consent_purpose: consent ? text(formData, "consent_purpose") || "Practice enquiry" : null,
      consent_at: consent ? new Date().toISOString() : null,
      custom_fields: custom,
    })
    .select("id, first_name, last_name, company")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save the lead." };

  const features = featuresFor(session.firm);
  if (features.workflows) {
    await runWorkflows(session.supabase, "lead.created", {
      firmId: session.firm.id,
      actorId: session.profile.id,
      leadId: data.id,
      relatedType: "lead",
      relatedId: data.id,
      link: `/leads/${data.id}`,
      vars: { lead_name: [data.first_name, data.last_name].filter(Boolean).join(" "), company: data.company ?? "" },
    });
  }
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  redirect(`/leads/${data.id}`);
}

export async function updateLead(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const id = text(formData, "id");
  const first = text(formData, "first_name");
  if (!id || !first) return { error: "First name is required." };
  const phone = phoneOrError(text(formData, "phone"));
  if (phone.error) return { error: phone.error };
  const consent = formData.get("consent_data_processing") === "on";
  const custom = await customPayload(formData, "lead", session.firm.id, session.supabase);
  const { error } = await session.supabase
    .from("leads")
    .update({
      first_name: first,
      last_name: text(formData, "last_name") || null,
      email: text(formData, "email") || null,
      phone: phone.phone,
      company: text(formData, "company") || null,
      source: text(formData, "source") || "manual",
      status: text(formData, "status") || "new",
      owner_id: text(formData, "owner_id") || null,
      city: text(formData, "city") || null,
      notes: text(formData, "notes") || null,
      consent_data_processing: consent,
      consent_marketing: formData.get("consent_marketing") === "on",
      consent_purpose: text(formData, "consent_purpose") || null,
      custom_fields: custom,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

export async function convertLead(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const id = text(formData, "id");
  const { data: lead } = await session.supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) return { error: "Lead not found." };
  const features = featuresFor(session.firm);
  const { count } = await session.supabase.from("accounts").select("id", { count: "exact", head: true }).eq("firm_id", session.firm.id);
  if ((count ?? 0) >= features.clients) return { error: `${features.name} includes ${features.clients} clients.` };

  const { data: account, error } = await session.supabase
    .from("accounts")
    .insert({
      firm_id: session.firm.id,
      name: lead.company || `${lead.first_name} ${lead.last_name ?? ""}`.trim(),
      entity_type: text(formData, "entity_type") || "proprietorship",
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      state_code: session.firm.state_code,
      place_of_supply: session.firm.state_code,
      gstin: lead.gstin,
      assigned_staff_id: lead.owner_id,
      consent_data_processing: lead.consent_data_processing,
      consent_purpose: lead.consent_purpose,
      consent_at: lead.consent_at,
      notes: lead.notes,
    })
    .select("id")
    .single();
  if (error || !account) return { error: error?.message ?? "Could not open the client." };

  const { data: contact } = await session.supabase
    .from("contacts")
    .insert({
      firm_id: session.firm.id,
      account_id: account.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      is_primary: true,
      consent_data_processing: lead.consent_data_processing,
      consent_purpose: lead.consent_purpose,
      consent_at: lead.consent_at,
    })
    .select("id")
    .single();

  await session.supabase
    .from("leads")
    .update({ status: "converted", converted_account_id: account.id, converted_contact_id: contact?.id ?? null })
    .eq("id", id);
  revalidatePath("/leads");
  revalidatePath("/clients");
  redirect(`/clients/${account.id}`);
}

export async function deleteLead(formData: FormData) {
  const session = await requireWriter();
  if (session.error) throw new Error(session.error);
  const id = text(formData, "id");
  const { error } = await session.supabase.from("leads").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
  redirect("/leads");
}

export async function createContact(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const first = text(formData, "first_name");
  if (!first) return { error: "First name is required." };
  const phone = phoneOrError(text(formData, "phone"));
  if (phone.error) return { error: phone.error };
  const consent = formData.get("consent_data_processing") === "on";
  const { data, error } = await session.supabase
    .from("contacts")
    .insert({
      firm_id: session.firm.id,
      account_id: text(formData, "account_id") || null,
      first_name: first,
      last_name: text(formData, "last_name") || null,
      email: text(formData, "email") || null,
      phone: phone.phone,
      designation: text(formData, "designation") || null,
      is_primary: formData.get("is_primary") === "on",
      consent_data_processing: consent,
      consent_marketing: formData.get("consent_marketing") === "on",
      consent_purpose: consent ? text(formData, "consent_purpose") || "Client records" : null,
      consent_at: consent ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save the contact." };
  revalidatePath("/contacts");
  redirect(`/contacts/${data.id}`);
}

export async function updateContact(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const id = text(formData, "id");
  const phone = phoneOrError(text(formData, "phone"));
  if (phone.error) return { error: phone.error };
  const consent = formData.get("consent_data_processing") === "on";
  const { error } = await session.supabase
    .from("contacts")
    .update({
      first_name: text(formData, "first_name"),
      last_name: text(formData, "last_name") || null,
      email: text(formData, "email") || null,
      phone: phone.phone,
      designation: text(formData, "designation") || null,
      account_id: text(formData, "account_id") || null,
      is_primary: formData.get("is_primary") === "on",
      consent_data_processing: consent,
      consent_marketing: formData.get("consent_marketing") === "on",
      consent_purpose: text(formData, "consent_purpose") || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/contacts/${id}`);
}

export async function anonymiseContact(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const id = text(formData, "id");
  const { error } = await session.supabase
    .from("contacts")
    .update({
      first_name: "Deleted",
      last_name: "contact",
      email: null,
      phone: null,
      designation: null,
      consent_marketing: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
}

export async function createAccount(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const name = text(formData, "name");
  if (!name) return { error: "Client name is required." };
  const features = featuresFor(session.firm);
  const { count } = await session.supabase.from("accounts").select("id", { count: "exact", head: true }).eq("firm_id", session.firm.id);
  if ((count ?? 0) >= features.clients) return { error: `${features.name} includes ${features.clients} clients. Move up a plan to add more.` };
  const gstinRaw = text(formData, "gstin");
  if (gstinRaw) {
    const check = validateGstin(gstinRaw);
    if (!check.ok) return { error: check.reason };
  }
  const phone = phoneOrError(text(formData, "phone"));
  if (phone.error) return { error: phone.error };
  const entity = text(formData, "entity_type") || "proprietorship";
  const auditDefault = entity === "pvt_ltd" || entity === "public_ltd" || entity === "llp";
  const consent = formData.get("consent_data_processing") === "on";
  const custom = await customPayload(formData, "account", session.firm.id, session.supabase);
  const { data, error } = await session.supabase
    .from("accounts")
    .insert({
      firm_id: session.firm.id,
      name,
      entity_type: entity,
      pan: text(formData, "pan").toUpperCase() || null,
      gstin: gstinRaw ? gstinRaw.toUpperCase() : null,
      gst_filing_frequency: text(formData, "gst_filing_frequency") || null,
      state_code: text(formData, "state_code") || session.firm.state_code,
      place_of_supply: text(formData, "place_of_supply") || text(formData, "state_code") || session.firm.state_code,
      requires_audit: formData.get("requires_audit") === "on" || auditDefault,
      email: text(formData, "email") || null,
      phone: phone.phone,
      address: text(formData, "address") || null,
      city: text(formData, "city") || null,
      pincode: text(formData, "pincode") || null,
      assigned_staff_id: text(formData, "assigned_staff_id") || session.profile.id,
      consent_data_processing: consent,
      consent_marketing: formData.get("consent_marketing") === "on",
      consent_purpose: consent ? text(formData, "consent_purpose") || "Tax and compliance services" : null,
      consent_at: consent ? new Date().toISOString() : null,
      notes: text(formData, "notes") || null,
      custom_fields: custom,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save the client." };
  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateAccount(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const id = text(formData, "id");
  const gstinRaw = text(formData, "gstin");
  if (gstinRaw) {
    const check = validateGstin(gstinRaw);
    if (!check.ok) return { error: check.reason };
  }
  const phone = phoneOrError(text(formData, "phone"));
  if (phone.error) return { error: phone.error };
  const consent = formData.get("consent_data_processing") === "on";
  const custom = await customPayload(formData, "account", session.firm.id, session.supabase);
  const { error } = await session.supabase
    .from("accounts")
    .update({
      name: text(formData, "name"),
      entity_type: text(formData, "entity_type"),
      pan: text(formData, "pan").toUpperCase() || null,
      gstin: gstinRaw ? gstinRaw.toUpperCase() : null,
      gst_filing_frequency: text(formData, "gst_filing_frequency") || null,
      state_code: text(formData, "state_code"),
      place_of_supply: text(formData, "place_of_supply"),
      requires_audit: formData.get("requires_audit") === "on",
      email: text(formData, "email") || null,
      phone: phone.phone,
      address: text(formData, "address") || null,
      city: text(formData, "city") || null,
      pincode: text(formData, "pincode") || null,
      assigned_staff_id: text(formData, "assigned_staff_id") || null,
      status: text(formData, "status") || "active",
      portal_enabled: formData.get("portal_enabled") === "on",
      consent_data_processing: consent,
      consent_marketing: formData.get("consent_marketing") === "on",
      consent_purpose: text(formData, "consent_purpose") || null,
      notes: text(formData, "notes") || null,
      custom_fields: custom,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

export async function createDeal(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const name = text(formData, "name");
  const stageId = text(formData, "stage_id");
  if (!name || !stageId) return { error: "Name and stage are required." };
  const { error } = await session.supabase.from("deals").insert({
    firm_id: session.firm.id,
    name,
    stage_id: stageId,
    account_id: text(formData, "account_id") || null,
    contact_id: text(formData, "contact_id") || null,
    amount: Number(text(formData, "amount") || "0"),
    expected_close: text(formData, "expected_close") || null,
    owner_id: text(formData, "owner_id") || session.profile.id,
    source: text(formData, "source") || null,
    notes: text(formData, "notes") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/deals");
  revalidatePath("/dashboard");
}

export async function moveDeal(dealId: string, stageId: string) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const { data: before } = await session.supabase.from("deals").select("id, name, stage_id").eq("id", dealId).maybeSingle();
  if (!before || before.stage_id === stageId) return { ok: true };
  const { data: stage } = await session.supabase.from("pipeline_stages").select("name").eq("id", stageId).maybeSingle();
  const { error } = await session.supabase.from("deals").update({ stage_id: stageId }).eq("id", dealId);
  if (error) return { error: error.message };
  if (featuresFor(session.firm).workflows) {
    await runWorkflows(session.supabase, "deal.stage_changed", {
      firmId: session.firm.id,
      actorId: session.profile.id,
      relatedType: "deal",
      relatedId: dealId,
      link: "/deals",
      vars: { deal_name: before.name, stage_name: stage?.name ?? "a new stage" },
    });
  }
  revalidatePath("/deals");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createActivity(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const subject = text(formData, "subject");
  if (!subject) return { error: "Subject is required." };
  const due = text(formData, "due_at");
  const { error } = await session.supabase.from("activities").insert({
    firm_id: session.firm.id,
    type: text(formData, "type") || "task",
    subject,
    body: text(formData, "body") || null,
    due_at: due ? new Date(due).toISOString() : null,
    related_type: text(formData, "related_type") || null,
    related_id: text(formData, "related_id") || null,
    owner_id: text(formData, "owner_id") || session.profile.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/activities");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function completeActivity(formData: FormData) {
  const session = await requireWriter();
  if (session.error) throw new Error(session.error);
  const id = text(formData, "id");
  const done = formData.get("done") === "on";
  const { error } = await session.supabase
    .from("activities")
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/activities");
  revalidatePath("/dashboard");
}

export async function saveView(formData: FormData) {
  const session = await requireStaff();
  const name = text(formData, "name");
  const module = text(formData, "module");
  if (!name || !module) return { error: "Name the view." };
  const filters = text(formData, "filters");
  const { error } = await session.supabase.from("saved_views").insert({
    firm_id: session.firm.id,
    user_id: session.profile.id,
    module,
    name,
    filters: filters ? JSON.parse(filters) : {},
    is_shared: formData.get("is_shared") === "on",
  });
  if (error) return { error: error.message };
  revalidatePath(`/${module === "account" ? "clients" : module + "s"}`);
}

export async function importCsv(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const module = text(formData, "module");
  const grid = parseCsv(String(formData.get("csv") ?? ""));
  const rows = rowsToObjects(grid);
  if (rows.length === 0) return { error: "The file has no data rows." };
  let inserted = 0;
  if (module === "leads") {
    const payload = rows
      .filter((row) => row.first_name)
      .map((row) => ({
        firm_id: session.firm.id,
        first_name: row.first_name,
        last_name: row.last_name || null,
        email: row.email || null,
        phone: row.phone ? normalizeIndianMobile(row.phone) : null,
        company: row.company || null,
        source: row.source || "import",
        city: row.city || null,
        notes: row.notes || null,
        owner_id: session.profile.id,
        consent_data_processing: row.consent === "yes",
        consent_purpose: row.consent === "yes" ? "Imported with consent" : null,
        consent_at: row.consent === "yes" ? new Date().toISOString() : null,
      }));
    const { error } = await session.supabase.from("leads").insert(payload);
    if (error) return { error: error.message };
    inserted = payload.length;
  } else if (module === "contacts") {
    const payload = rows
      .filter((row) => row.first_name)
      .map((row) => ({
        firm_id: session.firm.id,
        first_name: row.first_name,
        last_name: row.last_name || null,
        email: row.email || null,
        phone: row.phone ? normalizeIndianMobile(row.phone) : null,
        designation: row.designation || null,
        consent_data_processing: row.consent === "yes",
        consent_at: row.consent === "yes" ? new Date().toISOString() : null,
      }));
    const { error } = await session.supabase.from("contacts").insert(payload);
    if (error) return { error: error.message };
    inserted = payload.length;
  } else if (module === "clients") {
    const features = featuresFor(session.firm);
    const { count } = await session.supabase.from("accounts").select("id", { count: "exact", head: true });
    const room = features.clients - (count ?? 0);
    const payload = [];
    for (const row of rows) {
      if (!row.name) continue;
      if (row.gstin) {
        const check = validateGstin(row.gstin);
        if (!check.ok) return { error: `${row.name}: ${check.reason}` };
      }
      payload.push({
        firm_id: session.firm.id,
        name: row.name,
        entity_type: row.entity_type || "proprietorship",
        pan: row.pan?.toUpperCase() || null,
        gstin: row.gstin?.toUpperCase() || null,
        gst_filing_frequency: row.gst_filing_frequency || null,
        state_code: row.state_code || session.firm.state_code,
        place_of_supply: row.place_of_supply || row.state_code || session.firm.state_code,
        city: row.city || null,
        email: row.email || null,
        phone: row.phone ? normalizeIndianMobile(row.phone) : null,
        requires_audit: row.requires_audit === "yes",
        consent_data_processing: row.consent === "yes",
        consent_at: row.consent === "yes" ? new Date().toISOString() : null,
        assigned_staff_id: session.profile.id,
      });
    }
    if (payload.length > room) return { error: `This import needs ${payload.length} seats in the client list. ${features.name} has room for ${Math.max(room, 0)} more.` };
    const { error } = await session.supabase.from("accounts").insert(payload);
    if (error) return { error: error.message };
    inserted = payload.length;
  } else {
    return { error: "Choose leads, contacts, or clients." };
  }
  revalidatePath("/leads");
  revalidatePath("/contacts");
  revalidatePath("/clients");
  return { ok: `Imported ${inserted} rows.` };
}
