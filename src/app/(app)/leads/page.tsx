import Link from "next/link";
import { ActionForm, Submit } from "@/components/action-form";
import { CheckField, Field, PageHeader, SelectField, TextAreaField } from "@/components/kit";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { createLead, saveView } from "@/server/actions/crm";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; source?: string }> }) {
  const session = await requireStaff();
  const params = await searchParams;
  const canWrite = session.profile.role !== "readonly";
  let query = session.supabase.from("leads").select("id, first_name, last_name, company, source, status, city, created_at, owner_id").eq("firm_id", session.firm.id).order("created_at", { ascending: false });
  if (params.status) query = query.eq("status", params.status);
  if (params.source) query = query.eq("source", params.source);
  const [{ data: leads }, { data: staff }, { data: views }, { data: fields }] = await Promise.all([
    query,
    session.supabase.from("profiles").select("id, full_name").eq("firm_id", session.firm.id),
    session.supabase.from("saved_views").select("*").eq("module", "lead"),
    session.supabase.from("custom_field_defs").select("*").eq("firm_id", session.firm.id).eq("module", "lead"),
  ]);
  const names = new Map((staff ?? []).map((person) => [person.id, person.full_name]));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div>
        <PageHeader eyebrow="Pipeline" title="Leads" lede="Source is kept on every row, including the website form." />
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          {(views ?? []).map((view) => {
            const filters = view.filters as { status?: string };
            return <Link key={view.id} className="rounded-full bg-card px-3 py-1 ring-1 ring-foreground/10" href={`/leads?status=${filters.status ?? ""}`}>{view.name}</Link>;
          })}
          <a className="underline text-muted-foreground" href="/api/export/leads">Export CSV</a>
        </div>
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {(leads ?? []).map((lead) => (
                <tr key={lead.id} className="border-t border-border">
                  <td className="px-3 py-2"><Link href={`/leads/${lead.id}`}>{lead.first_name} {lead.last_name}</Link></td>
                  <td className="px-3 py-2">{lead.company}</td>
                  <td className="px-3 py-2 capitalize">{lead.source}</td>
                  <td className="px-3 py-2 capitalize">{lead.status}</td>
                  <td className="px-3 py-2">{names.get(lead.owner_id) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canWrite ? (
          <ActionForm action={saveView} className="mt-3 max-w-md">
            <input type="hidden" name="module" value="lead" />
            <input type="hidden" name="filters" value={JSON.stringify({ status: params.status ?? "", source: params.source ?? "" })} />
            <Field label="Save this filter" name="name" placeholder="New walk-ins" />
            <CheckField label="Share with the firm" name="is_shared" />
            <Submit>Save view</Submit>
          </ActionForm>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">Newest row {leads?.[0] ? formatDate(leads[0].created_at) : "—"}</p>
      </div>
      {canWrite ? (
        <ActionForm action={createLead} className="h-fit rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="font-display text-2xl">New lead</p>
          <Field label="First name" name="first_name" required />
          <Field label="Last name" name="last_name" />
          <Field label="Company" name="company" />
          <Field label="Phone" name="phone" />
          <Field label="Email" name="email" type="email" />
          <Field label="City" name="city" />
          <SelectField label="Source" name="source" defaultValue="walk-in">
            {LEAD_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
          </SelectField>
          <SelectField label="Owner" name="owner_id" defaultValue={session.profile.id}>
            {(staff ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
          </SelectField>
          {(fields ?? []).map((field) => (
            <Field key={field.id} label={field.label} name={`cf_${field.key}`} />
          ))}
          <TextAreaField label="Notes" name="notes" />
          <CheckField label="Consent to store this enquiry" name="consent_data_processing" />
          <Field label="Consent purpose" name="consent_purpose" defaultValue="Practice enquiry" />
          <Submit>Save lead</Submit>
        </ActionForm>
      ) : null}
    </div>
  );
}

export const leadStatuses = LEAD_STATUSES;
