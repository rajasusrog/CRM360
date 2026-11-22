import Link from "next/link";
import { ActionForm, Submit } from "@/components/action-form";
import { CheckField, Field, PageHeader, SelectField } from "@/components/kit";
import { formatIndianMobile } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { createContact } from "@/server/actions/crm";

export default async function ContactsPage() {
  const session = await requireStaff();
  const canWrite = session.profile.role !== "readonly";
  const [{ data: contacts }, { data: accounts }] = await Promise.all([
    session.supabase.from("contacts").select("id, first_name, last_name, email, phone, designation, account_id, deleted_at").eq("firm_id", session.firm.id).order("first_name"),
    session.supabase.from("accounts").select("id, name").eq("firm_id", session.firm.id),
  ]);
  const names = new Map((accounts ?? []).map((account) => [account.id, account.name]));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div>
        <PageHeader eyebrow="People" title="Contacts" lede="Personal data stays with a consent flag, and can be exported or anonymised." />
        <a className="text-sm underline text-muted-foreground" href="/api/export/contacts">Export CSV</a>
        <div className="mt-3 overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">Role</th></tr></thead>
            <tbody>
              {(contacts ?? []).map((contact) => (
                <tr key={contact.id} className="border-t border-border">
                  <td className="px-3 py-2"><Link href={`/contacts/${contact.id}`}>{contact.first_name} {contact.last_name}</Link></td>
                  <td className="px-3 py-2">{names.get(contact.account_id) ?? "—"}</td>
                  <td className="px-3 py-2">{contact.deleted_at ? "Removed" : formatIndianMobile(contact.phone)}</td>
                  <td className="px-3 py-2">{contact.designation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {canWrite ? (
        <ActionForm action={createContact} className="h-fit rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="font-display text-2xl">New contact</p>
          <Field label="First name" name="first_name" required />
          <Field label="Last name" name="last_name" />
          <Field label="Phone" name="phone" />
          <Field label="Email" name="email" type="email" />
          <Field label="Designation" name="designation" />
          <SelectField label="Client" name="account_id">
            <option value="">None</option>
            {(accounts ?? []).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </SelectField>
          <CheckField label="Primary contact" name="is_primary" />
          <CheckField label="Consent to process personal data" name="consent_data_processing" />
          <Submit>Save contact</Submit>
        </ActionForm>
      ) : null}
    </div>
  );
}
