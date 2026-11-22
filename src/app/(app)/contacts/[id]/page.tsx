import { notFound } from "next/navigation";
import { ActionForm, Submit } from "@/components/action-form";
import { Field, SelectField } from "@/components/kit";
import { formatDateTime, formatIndianMobile } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { anonymiseContact, updateContact } from "@/server/actions/crm";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const { data: contact } = await session.supabase.from("contacts").select("*").eq("id", id).maybeSingle();
  if (!contact) notFound();
  const { data: accounts } = await session.supabase.from("accounts").select("id, name").eq("firm_id", session.firm.id);
  const canWrite = session.profile.role !== "readonly";

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-4xl">{contact.first_name} {contact.last_name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{formatIndianMobile(contact.phone)} · consent {contact.consent_data_processing ? `yes, ${formatDateTime(contact.consent_at)}` : "not recorded"}</p>
      <div className="mt-3 flex gap-3 text-sm">
        <a className="underline" href={`/api/contacts/${contact.id}/export`}>Export personal data</a>
      </div>
      {canWrite && !contact.deleted_at ? (
        <div className="mt-6 grid gap-4">
          <ActionForm action={updateContact} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <input type="hidden" name="id" value={contact.id} />
            <Field label="First name" name="first_name" defaultValue={contact.first_name} />
            <Field label="Last name" name="last_name" defaultValue={contact.last_name} />
            <Field label="Phone" name="phone" defaultValue={contact.phone} />
            <Field label="Email" name="email" defaultValue={contact.email} />
            <Field label="Designation" name="designation" defaultValue={contact.designation} />
            <SelectField label="Client" name="account_id" defaultValue={contact.account_id}>
              <option value="">None</option>
              {(accounts ?? []).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </SelectField>
            <Submit>Save</Submit>
          </ActionForm>
          <ActionForm action={anonymiseContact}>
            <input type="hidden" name="id" value={contact.id} />
            <p className="text-sm text-muted-foreground">Anonymise removes the name, phone, and email. Invoices stay, because tax law keeps them.</p>
            <Submit>Delete personal data</Submit>
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
