"use server";

import { revalidatePath } from "next/cache";
import { featuresFor } from "@/lib/plans";
import { generateFilings, resolveRules } from "@/lib/compliance/generate";
import type { ComplianceClient, ComplianceRule, StoredRule, YearOffset } from "@/lib/compliance/types";
import { currentFyStartYear } from "@/lib/format";
import { paiseToRupees, rupeesToPaise, splitGst } from "@/lib/gst/tax";
import { getMessageAdapter } from "@/lib/messages";
import { renderTemplate } from "@/lib/templates";
import { requireStaff, requireWriter } from "@/lib/session";
import { createAdmin } from "@/lib/supabase/admin";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function mapRule(row: Record<string, unknown>, periods: Array<Record<string, unknown>>): StoredRule {
  return {
    firmId: (row.firm_id as string | null) ?? null,
    code: String(row.code),
    variant: String(row.variant),
    name: String(row.name),
    frequency: row.frequency as ComplianceRule["frequency"],
    entityTypes: (row.entity_types as string[] | null) ?? null,
    gstFrequencies: (row.gst_frequencies as Array<"monthly" | "quarterly"> | null) ?? null,
    requiresGstin: Boolean(row.requires_gstin),
    auditMode: row.audit_mode as ComplianceRule["auditMode"],
    stateCodes: (row.state_codes as string[] | null) ?? null,
    notes: String(row.notes ?? ""),
    periods: periods
      .filter((period) => period.rule_id === row.id)
      .sort((a, b) => Number(a.sort) - Number(b.sort))
      .map((period) => ({
        key: String(period.period_key),
        label: String(period.label),
        startMonth: Number(period.start_month),
        startYearOffset: Number(period.start_year_offset) as YearOffset,
        endMonth: Number(period.end_month),
        endYearOffset: Number(period.end_year_offset) as YearOffset,
        dueMonth: Number(period.due_month),
        dueDay: Number(period.due_day),
        dueYearOffset: Number(period.due_year_offset) as YearOffset,
      })),
  };
}

async function loadRules(supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"], firmId: string) {
  const { data: rules } = await supabase.from("compliance_rules").select("*").eq("active", true);
  const ids = (rules ?? []).map((rule) => rule.id);
  const { data: periods } = await supabase.from("compliance_rule_periods").select("*").in("rule_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const stored = (rules ?? []).map((rule) => mapRule(rule, periods ?? []));
  return resolveRules(stored, firmId);
}

export async function generateCompliance(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const fy = Number(text(formData, "fy_start_year") || currentFyStartYear());
  const onlyAccount = text(formData, "account_id");
  let query = session.supabase.from("accounts").select("*").eq("firm_id", session.firm.id).eq("status", "active");
  if (onlyAccount) query = query.eq("id", onlyAccount);
  const { data: accounts } = await query;
  const rules = await loadRules(session.supabase, session.firm.id);
  let created = 0;
  for (const account of accounts ?? []) {
    const client: ComplianceClient = {
      entityType: account.entity_type,
      gstin: account.gstin,
      gstFilingFrequency: account.gst_filing_frequency,
      stateCode: account.state_code,
      requiresAudit: account.requires_audit,
    };
    const drafts = generateFilings(rules, client, fy);
    if (drafts.length === 0) continue;
    const { error } = await session.supabase.from("compliance_filings").upsert(
      drafts.map((draft) => ({
        firm_id: session.firm.id,
        account_id: account.id,
        rule_code: draft.ruleCode,
        name: draft.name,
        period_key: draft.periodKey,
        period_label: draft.periodLabel,
        fy_start_year: draft.fyStartYear,
        period_start: draft.periodStart,
        period_end: draft.periodEnd,
        due_date: draft.dueDate,
        assigned_to: account.assigned_staff_id,
        status: "pending",
      })),
      { onConflict: "account_id,rule_code,fy_start_year,period_key", ignoreDuplicates: true },
    );
    if (error) return { error: error.message };
    created += drafts.length;
  }
  revalidatePath("/compliance");
  revalidatePath("/dashboard");
  return { ok: `Checked ${created} due dates. Existing filings were left as they are.` };
}

export async function updateFiling(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const id = text(formData, "id");
  const status = text(formData, "status");
  const { error } = await session.supabase
    .from("compliance_filings")
    .update({
      status,
      acknowledgement_no: text(formData, "acknowledgement_no") || null,
      notes: text(formData, "notes") || null,
      filed_at: status === "filed" ? new Date().toISOString() : null,
      assigned_to: text(formData, "assigned_to") || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/compliance");
  revalidatePath("/dashboard");
}

export async function createInvoice(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const accountId = text(formData, "account_id");
  const description = text(formData, "description");
  const taxable = Number(text(formData, "taxable_value"));
  if (!accountId || !description || !Number.isFinite(taxable) || taxable < 0) return { error: "Client, description, and fee are required." };
  const { data: account } = await session.supabase.from("accounts").select("place_of_supply, name").eq("id", accountId).maybeSingle();
  if (!account) return { error: "Client not found." };
  const place = text(formData, "place_of_supply") || account.place_of_supply;
  const split = splitGst(rupeesToPaise(taxable), session.firm.state_code, place);
  const { count } = await session.supabase.from("invoices").select("id", { count: "exact", head: true }).eq("firm_id", session.firm.id);
  const fy = currentFyStartYear();
  const number = text(formData, "invoice_number") || `KA/${String(fy).slice(2)}-${String(fy + 1).slice(2)}/${String((count ?? 0) + 1).padStart(3, "0")}`;
  const { data, error } = await session.supabase
    .from("invoices")
    .insert({
      firm_id: session.firm.id,
      account_id: accountId,
      engagement_id: text(formData, "engagement_id") || null,
      invoice_number: number,
      invoice_date: text(formData, "invoice_date") || new Date().toISOString().slice(0, 10),
      due_date: text(formData, "due_date") || null,
      place_of_supply: place,
      sac_code: text(formData, "sac_code") || session.firm.sac_code,
      description,
      taxable_value: paiseToRupees(split.taxablePaise),
      cgst: paiseToRupees(split.cgstPaise),
      sgst: paiseToRupees(split.sgstPaise),
      igst: paiseToRupees(split.igstPaise),
      total: paiseToRupees(split.totalPaise),
      status: "sent",
      notes: text(formData, "notes") || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not raise the invoice." };
  revalidatePath("/invoices");
  revalidatePath(`/clients/${accountId}`);
  const { redirect } = await import("next/navigation");
  redirect(`/invoices/${data.id}`);
}

export async function recordPayment(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const invoiceId = text(formData, "invoice_id");
  const amount = Number(text(formData, "amount"));
  if (!invoiceId || !(amount > 0)) return { error: "Enter the amount received." };
  const { data: invoice } = await session.supabase.from("invoices").select("id, total, status").eq("id", invoiceId).maybeSingle();
  if (!invoice) return { error: "Invoice not found." };
  const { error } = await session.supabase.from("invoice_payments").insert({
    firm_id: session.firm.id,
    invoice_id: invoiceId,
    amount,
    paid_on: text(formData, "paid_on") || new Date().toISOString().slice(0, 10),
    mode: text(formData, "mode") || "bank",
    reference: text(formData, "reference") || null,
  });
  if (error) return { error: error.message };
  const { data: payments } = await session.supabase.from("invoice_payments").select("amount").eq("invoice_id", invoiceId);
  const paid = (payments ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const status = paid + 0.5 >= Number(invoice.total) ? "paid" : paid > 0 ? "partial" : invoice.status;
  await session.supabase.from("invoices").update({ status }).eq("id", invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/reports");
}

export async function createEngagement(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const { error } = await session.supabase.from("engagements").insert({
    firm_id: session.firm.id,
    account_id: text(formData, "account_id"),
    service_name: text(formData, "service_name"),
    sac_code: text(formData, "sac_code") || session.firm.sac_code,
    fee: Number(text(formData, "fee") || "0"),
    billing_cycle: text(formData, "billing_cycle") || "annual",
    start_date: text(formData, "start_date") || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/clients/${text(formData, "account_id")}`);
}

export async function createTimeEntry(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const minutes = Number(text(formData, "minutes"));
  if (!minutes || minutes <= 0) return { error: "Enter the minutes worked." };
  const { error } = await session.supabase.from("time_entries").insert({
    firm_id: session.firm.id,
    user_id: text(formData, "user_id") || session.profile.id,
    account_id: text(formData, "account_id") || null,
    engagement_id: text(formData, "engagement_id") || null,
    work_date: text(formData, "work_date") || new Date().toISOString().slice(0, 10),
    minutes,
    description: text(formData, "description") || null,
    billable: formData.get("billable") === "on",
  });
  if (error) return { error: error.message };
  revalidatePath("/time");
}

export async function uploadDocument(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const file = formData.get("file");
  const accountId = text(formData, "account_id");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  if (!accountId) return { error: "Choose a client." };
  if (file.size > 20 * 1024 * 1024) return { error: "Files must be 20 MB or smaller." };
  const fy = text(formData, "financial_year") || "2026-27";
  const folder = text(formData, "folder") || "General";
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
  const path = `${session.firm.id}/${accountId}/${fy}/${crypto.randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await session.supabase.storage.from("documents").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) return { error: uploadError.message };
  const requestId = text(formData, "request_id");
  const { error } = await session.supabase.from("documents").insert({
    firm_id: session.firm.id,
    account_id: accountId,
    financial_year: fy,
    folder,
    name: safeName,
    storage_path: path,
    mime: file.type || null,
    size_bytes: file.size,
    uploaded_by: session.profile.id,
    client_visible: formData.get("client_visible") === "on",
  });
  if (error) return { error: error.message };
  if (requestId) {
    await session.supabase.from("document_requests").update({ status: "uploaded" }).eq("id", requestId);
  }
  revalidatePath(`/clients/${accountId}`);
  revalidatePath("/portal");
}

export async function createDocumentRequest(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const token = crypto.randomUUID().replaceAll("-", "");
  const { error } = await session.supabase.from("document_requests").insert({
    firm_id: session.firm.id,
    account_id: text(formData, "account_id"),
    title: text(formData, "title"),
    financial_year: text(formData, "financial_year") || "2026-27",
    folder: text(formData, "folder") || "Client uploads",
    notes: text(formData, "notes") || null,
    upload_token: token,
  });
  if (error) return { error: error.message };
  revalidatePath(`/clients/${text(formData, "account_id")}`);
  return { ok: token };
}

export async function uploadWithToken(formData: FormData) {
  const token = text(formData, "token");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  const admin = createAdmin();
  const { data: request } = await admin.from("document_requests").select("*").eq("upload_token", token).maybeSingle();
  if (!request) return { error: "This upload link is not valid." };
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
  const path = `${request.firm_id}/${request.account_id}/${request.financial_year}/${crypto.randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from("documents").upload(path, bytes, { contentType: file.type || "application/octet-stream" });
  if (uploadError) return { error: uploadError.message };
  const { error } = await admin.from("documents").insert({
    firm_id: request.firm_id,
    account_id: request.account_id,
    financial_year: request.financial_year,
    folder: request.folder,
    name: safeName,
    storage_path: path,
    mime: file.type || null,
    size_bytes: file.size,
    client_visible: true,
  });
  if (error) return { error: error.message };
  await admin.from("document_requests").update({ status: "uploaded" }).eq("id", request.id);
  return { ok: "Received. The firm can see it on the client file." };
}

export async function sendTemplate(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const { data: template } = await session.supabase.from("message_templates").select("*").eq("id", text(formData, "template_id")).maybeSingle();
  if (!template) return { error: "Template not found." };
  const vars = {
    name: text(formData, "name"),
    firm_name: session.firm.name,
    due_date: text(formData, "due_date"),
    filing: text(formData, "filing"),
    period: text(formData, "period"),
    invoice_number: text(formData, "invoice_number"),
    amount: text(formData, "amount"),
  };
  const body = renderTemplate(template.body, vars);
  const subject = template.subject ? renderTemplate(template.subject, vars) : undefined;
  const to = text(formData, "to");
  if (!to) return { error: "Add a recipient." };
  const adapter = getMessageAdapter();
  const result = await adapter.send({
    firmId: session.firm.id,
    channel: template.channel,
    to,
    subject,
    body,
    relatedType: text(formData, "related_type") || undefined,
    relatedId: text(formData, "related_id") || undefined,
  });
  await session.supabase.from("outbound_messages").insert({
    firm_id: session.firm.id,
    channel: template.channel,
    recipient: to,
    subject: subject ?? null,
    body,
    status: result.status,
    provider: result.provider,
    related_type: text(formData, "related_type") || null,
    related_id: text(formData, "related_id") || null,
  });
  revalidatePath("/settings");
  return { ok: `Saved as ${result.status}. Delivery is stubbed until a provider is connected.`, body };
}

export async function invitePortal(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  if (!featuresFor(session.firm).portal) return { error: "The client portal is on the Growth and Pro plans." };
  const email = text(formData, "email").toLowerCase();
  const accountId = text(formData, "account_id");
  if (!email || !accountId) return { error: "Email and client are required." };
  const token = crypto.randomUUID().replaceAll("-", "");
  const { error } = await session.supabase.from("portal_invites").insert({
    firm_id: session.firm.id,
    account_id: accountId,
    email,
    token,
  });
  if (error) return { error: error.message };
  await session.supabase.from("accounts").update({ portal_enabled: true }).eq("id", accountId);
  revalidatePath(`/clients/${accountId}`);
  return { ok: token };
}
