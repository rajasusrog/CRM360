import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Submit } from "@/components/action-form";
import { CheckField, Field, SelectField, TextAreaField } from "@/components/kit";
import { ENTITY_TYPES, INDIAN_STATES, entityLabel, stateName } from "@/lib/constants";
import { formatDate, formatInr, formatIndianMobile, todayIsoInIst, whatsAppLink } from "@/lib/format";
import { validateGstin } from "@/lib/gst/gstin";
import { featuresFor } from "@/lib/plans";
import { renderTemplate } from "@/lib/templates";
import { requireStaff } from "@/lib/session";
import { updateAccount } from "@/server/actions/crm";
import { createDocumentRequest, createEngagement, createTimeEntry, generateCompliance, invitePortal, uploadDocument } from "@/server/actions/practice";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const canWrite = session.profile.role !== "readonly";
  const { data: account } = await session.supabase.from("accounts").select("*").eq("id", id).maybeSingle();
  if (!account) notFound();
  const [filings, documents, requests, invoices, time, engagements, staff, templates] = await Promise.all([
    session.supabase.from("compliance_filings").select("id, name, period_label, due_date, status").eq("account_id", id).order("due_date").limit(12),
    session.supabase.from("documents").select("id, name, folder, financial_year, client_visible").eq("account_id", id).order("created_at", { ascending: false }),
    session.supabase.from("document_requests").select("id, title, status, upload_token, financial_year").eq("account_id", id),
    session.supabase.from("invoices").select("id, invoice_number, total, status, invoice_date").eq("account_id", id).order("invoice_date", { ascending: false }),
    session.supabase.from("time_entries").select("id, work_date, minutes, description, profiles(full_name)").eq("account_id", id).order("work_date", { ascending: false }).limit(8),
    session.supabase.from("engagements").select("*").eq("account_id", id),
    session.supabase.from("profiles").select("id, full_name").eq("firm_id", session.firm.id),
    session.supabase.from("message_templates").select("*").eq("firm_id", session.firm.id).eq("channel", "whatsapp").limit(1),
  ]);
  const gstin = account.gstin ? validateGstin(account.gstin) : null;
  const today = todayIsoInIst();
  const template = templates.data?.[0];
  const wa = account.phone && template
    ? whatsAppLink(account.phone, renderTemplate(template.body, { name: account.name, firm_name: session.firm.name, filing: "GSTR-3B", period: "this month", due_date: "the due date" }))
    : null;
  const plan = featuresFor(session.firm);

  return (
    <div className="grid gap-6">
      <header className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{entityLabel(account.entity_type)} · {stateName(account.state_code)}</p>
        <h1 className="font-display text-4xl">{account.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-muted px-3 py-1">{account.gst_filing_frequency ? `${account.gst_filing_frequency} GST` : "No GSTIN"}</span>
          <span className="rounded-full bg-muted px-3 py-1">{account.requires_audit ? "Audit" : "Non-audit"}</span>
          {gstin ? <span className={`rounded-full px-3 py-1 ${gstin.ok ? "bg-primary text-primary-foreground" : "bg-destructive text-white"}`}>{gstin.ok ? account.gstin : gstin.reason}</span> : null}
          <span className="rounded-full bg-muted px-3 py-1">{formatIndianMobile(account.phone)}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {wa ? <a className="underline" href={wa} target="_blank" rel="noreferrer">WhatsApp reminder</a> : null}
          <Link className="underline" href={`/invoices`}>Raise invoice</Link>
        </div>
      </header>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-display text-2xl">Upcoming and open filings</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {(filings.data ?? []).filter((filing) => filing.status !== "filed" || filing.due_date >= today).slice(0, 8).map((filing) => (
              <li key={filing.id} className="flex justify-between py-2">
                <span>{filing.name} · {filing.period_label}</span>
                <span className={filing.status !== "filed" && filing.due_date < today ? "text-destructive" : ""}>{formatDate(filing.due_date)} · {filing.status}</span>
              </li>
            ))}
          </ul>
          {canWrite ? (
            <ActionForm action={generateCompliance} className="mt-3">
              <input type="hidden" name="account_id" value={account.id} />
              <Submit>Generate FY {today.slice(0, 4)} filings</Submit>
            </ActionForm>
          ) : null}
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-display text-2xl">Documents</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(documents.data ?? []).map((document) => (
              <li key={document.id} className="flex justify-between gap-2">
                <a className="underline" href={`/api/documents/${document.id}`}>{document.name}</a>
                <span className="text-muted-foreground">{document.financial_year} · {document.folder}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {(requests.data ?? []).map((request) => (
              <li key={request.id}>{request.title} · {request.status} · /upload/{request.upload_token}</li>
            ))}
          </ul>
          {canWrite ? (
            <div className="mt-3 grid gap-4">
              <ActionForm action={uploadDocument}>
                <input type="hidden" name="account_id" value={account.id} />
                <Field label="Financial year" name="financial_year" defaultValue="2026-27" />
                <Field label="Folder" name="folder" defaultValue="General" />
                <input type="file" name="file" required className="text-sm" />
                <CheckField label="Visible in the client portal" name="client_visible" />
                <Submit>Upload</Submit>
              </ActionForm>
              <ActionForm action={createDocumentRequest}>
                <input type="hidden" name="account_id" value={account.id} />
                <Field label="Ask the client for" name="title" required />
                <Submit>Create upload link</Submit>
              </ActionForm>
            </div>
          ) : null}
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-display text-2xl">Invoices and engagements</h2>
          <ul className="mt-2 text-sm">
            {(engagements.data ?? []).map((engagement) => (
              <li key={engagement.id}>{engagement.service_name} · {formatInr(Number(engagement.fee))} · {engagement.billing_cycle}</li>
            ))}
          </ul>
          <ul className="mt-2 divide-y divide-border text-sm">
            {(invoices.data ?? []).map((invoice) => (
              <li key={invoice.id} className="flex justify-between py-2">
                <Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>
                <span>{formatInr(Number(invoice.total))} · {invoice.status}</span>
              </li>
            ))}
          </ul>
          {canWrite ? (
            <ActionForm action={createEngagement} className="mt-3">
              <input type="hidden" name="account_id" value={account.id} />
              <Field label="Service" name="service_name" required />
              <Field label="Fee excl. GST" name="fee" type="number" />
              <SelectField label="Cycle" name="billing_cycle" defaultValue="annual">
                <option value="one_time">One time</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </SelectField>
              <Submit>Add engagement</Submit>
            </ActionForm>
          ) : null}
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-display text-2xl">Time</h2>
          <ul className="mt-2 text-sm">
            {(time.data ?? []).map((entry) => {
              const person = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
              return <li key={entry.id}>{formatDate(entry.work_date)} · {entry.minutes} min · {person?.full_name} · {entry.description}</li>;
            })}
          </ul>
          {canWrite ? (
            <ActionForm action={createTimeEntry} className="mt-3">
              <input type="hidden" name="account_id" value={account.id} />
              <Field label="Date" name="work_date" type="date" defaultValue={todayIsoInIst()} />
              <Field label="Minutes" name="minutes" type="number" required />
              <Field label="What was done" name="description" />
              <CheckField label="Billable" name="billable" defaultChecked />
              <Submit>Log time</Submit>
            </ActionForm>
          ) : null}
          {canWrite && plan.portal ? (
            <ActionForm action={invitePortal} className="mt-4">
              <input type="hidden" name="account_id" value={account.id} />
              <Field label="Portal invite email" name="email" type="email" defaultValue={account.email} />
              <Submit>Invite to the portal</Submit>
            </ActionForm>
          ) : null}
        </div>
      </section>
      {canWrite ? (
        <details className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <summary className="cursor-pointer font-display text-2xl">Edit client master</summary>
          <ActionForm action={updateAccount} className="mt-3">
            <input type="hidden" name="id" value={account.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" name="name" defaultValue={account.name} required />
              <SelectField label="Entity" name="entity_type" defaultValue={account.entity_type}>
                {ENTITY_TYPES.map((entity) => <option key={entity.value} value={entity.value}>{entity.label}</option>)}
              </SelectField>
              <Field label="PAN" name="pan" defaultValue={account.pan} />
              <Field label="GSTIN" name="gstin" defaultValue={account.gstin} />
              <SelectField label="GST frequency" name="gst_filing_frequency" defaultValue={account.gst_filing_frequency}>
                <option value="">Not registered</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </SelectField>
              <SelectField label="State" name="state_code" defaultValue={account.state_code}>
                {INDIAN_STATES.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
              </SelectField>
              <SelectField label="Place of supply" name="place_of_supply" defaultValue={account.place_of_supply}>
                {INDIAN_STATES.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
              </SelectField>
              <Field label="City" name="city" defaultValue={account.city} />
              <Field label="Phone" name="phone" defaultValue={account.phone} />
              <Field label="Email" name="email" defaultValue={account.email} />
              <SelectField label="Staff" name="assigned_staff_id" defaultValue={account.assigned_staff_id}>
                {(staff.data ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
              </SelectField>
              <SelectField label="Status" name="status" defaultValue={account.status}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </SelectField>
            </div>
            <TextAreaField label="Address" name="address" defaultValue={account.address} />
            <TextAreaField label="Notes" name="notes" defaultValue={account.notes} />
            <CheckField label="Requires audit" name="requires_audit" defaultChecked={account.requires_audit} />
            <CheckField label="Consent captured" name="consent_data_processing" defaultChecked={account.consent_data_processing} />
            <Field label="Consent purpose" name="consent_purpose" defaultValue={account.consent_purpose} />
            <Submit>Save changes</Submit>
          </ActionForm>
        </details>
      ) : null}
    </div>
  );
}
