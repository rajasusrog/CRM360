import Link from "next/link";
import { ActionForm, Submit } from "@/components/action-form";
import { CheckField, Field, PageHeader, SelectField, TextAreaField } from "@/components/kit";
import { ENTITY_TYPES, INDIAN_STATES } from "@/lib/constants";
import { requireStaff } from "@/lib/session";
import { createAccount } from "@/server/actions/crm";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ staff?: string; q?: string }> }) {
  const session = await requireStaff();
  const params = await searchParams;
  const canWrite = session.profile.role !== "readonly";
  let query = session.supabase.from("accounts").select("id, name, entity_type, gstin, city, gst_filing_frequency, assigned_staff_id, status").eq("firm_id", session.firm.id).order("name");
  if (params.staff) query = query.eq("assigned_staff_id", params.staff);
  if (params.q) query = query.ilike("name", `%${params.q}%`);
  const [{ data: accounts }, { data: staff }, { data: views }] = await Promise.all([
    query,
    session.supabase.from("profiles").select("id, full_name").eq("firm_id", session.firm.id),
    session.supabase.from("saved_views").select("id, name, filters").eq("module", "account").or(`user_id.eq.${session.profile.id},is_shared.eq.true`),
  ]);
  const names = new Map((staff ?? []).map((person) => [person.id, person.full_name]));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div>
        <PageHeader eyebrow="Client master" title="Clients" lede="PAN, GSTIN, filing frequency, and the person who owns the file." />
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          {(views ?? []).map((view) => {
            const filters = view.filters as { staff?: string };
            return (
              <Link key={view.id} href={`/clients?staff=${filters.staff ?? ""}`} className="rounded-full bg-card px-3 py-1 ring-1 ring-foreground/10">
                {view.name}
              </Link>
            );
          })}
          <a href="/api/export/clients" className="rounded-full px-3 py-1 text-muted-foreground underline">Export CSV</a>
        </div>
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">GSTIN</th>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">GST</th>
                <th className="px-3 py-2 font-medium">Staff</th>
              </tr>
            </thead>
            <tbody>
              {(accounts ?? []).map((account) => (
                <tr key={account.id} className="border-t border-border">
                  <td className="px-3 py-2"><Link href={`/clients/${account.id}`}>{account.name}</Link></td>
                  <td className="px-3 py-2 font-mono text-xs">{account.gstin ?? "—"}</td>
                  <td className="px-3 py-2">{account.city}</td>
                  <td className="px-3 py-2 capitalize">{account.gst_filing_frequency ?? "—"}</td>
                  <td className="px-3 py-2">{names.get(account.assigned_staff_id) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {canWrite ? (
        <ActionForm action={createAccount} className="h-fit rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="font-display text-2xl">New client</p>
          <Field label="Name" name="name" required />
          <SelectField label="Entity" name="entity_type" defaultValue="proprietorship">
            {ENTITY_TYPES.map((entity) => <option key={entity.value} value={entity.value}>{entity.label}</option>)}
          </SelectField>
          <Field label="PAN" name="pan" />
          <Field label="GSTIN" name="gstin" />
          <SelectField label="GST frequency" name="gst_filing_frequency">
            <option value="">Not registered</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly (QRMP)</option>
          </SelectField>
          <SelectField label="State" name="state_code" defaultValue="33">
            {INDIAN_STATES.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
          </SelectField>
          <Field label="City" name="city" />
          <Field label="Phone" name="phone" />
          <Field label="Email" name="email" type="email" />
          <SelectField label="Assigned staff" name="assigned_staff_id" defaultValue={session.profile.id}>
            {(staff ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
          </SelectField>
          <CheckField label="Tax audit applies" name="requires_audit" />
          <CheckField label="Consent to process personal data" name="consent_data_processing" />
          <TextAreaField label="Notes" name="notes" />
          <Submit>Save client</Submit>
        </ActionForm>
      ) : null}
    </div>
  );
}
