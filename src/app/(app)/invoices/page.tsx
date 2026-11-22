import Link from "next/link";
import { ActionForm, Submit } from "@/components/action-form";
import { Field, PageHeader, SelectField, TextAreaField } from "@/components/kit";
import { SAC_CODES } from "@/lib/constants";
import { formatDate, formatInr, todayIsoInIst } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { createInvoice } from "@/server/actions/practice";

export default async function InvoicesPage() {
  const session = await requireStaff();
  const canWrite = session.profile.role !== "readonly";
  const [{ data: invoices }, { data: accounts }, { data: engagements }] = await Promise.all([
    session.supabase.from("invoices").select("id, invoice_number, invoice_date, total, status, place_of_supply, accounts(name)").eq("firm_id", session.firm.id).order("invoice_date", { ascending: false }),
    session.supabase.from("accounts").select("id, name, place_of_supply").eq("firm_id", session.firm.id).order("name"),
    session.supabase.from("engagements").select("id, service_name, account_id").eq("firm_id", session.firm.id),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div>
        <PageHeader eyebrow="Billing" title="Invoices" lede="Fees are exclusive of GST. The tax split follows the client's place of supply." />
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Number</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(invoices ?? []).map((invoice) => {
                const account = Array.isArray(invoice.accounts) ? invoice.accounts[0] : invoice.accounts;
                return (
                  <tr key={invoice.id} className="border-t border-border">
                    <td className="px-3 py-2"><Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></td>
                    <td className="px-3 py-2">{account?.name}</td>
                    <td className="px-3 py-2">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-3 py-2">{formatInr(Number(invoice.total))}</td>
                    <td className="px-3 py-2 capitalize">{invoice.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {canWrite ? (
        <ActionForm action={createInvoice} className="h-fit rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="font-display text-2xl">Raise an invoice</p>
          <SelectField label="Client" name="account_id" required>
            <option value="">Select</option>
            {(accounts ?? []).map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </SelectField>
          <SelectField label="Engagement" name="engagement_id">
            <option value="">None</option>
            {(engagements ?? []).map((engagement) => (
              <option key={engagement.id} value={engagement.id}>{engagement.service_name}</option>
            ))}
          </SelectField>
          <TextAreaField label="Description" name="description" />
          <Field label="Taxable value (INR)" name="taxable_value" type="number" required />
          <SelectField label="SAC" name="sac_code" defaultValue={session.firm.sac_code}>
            {SAC_CODES.map((sac) => (
              <option key={sac.code} value={sac.code}>{sac.label}</option>
            ))}
          </SelectField>
          <Field label="Invoice date" name="invoice_date" type="date" defaultValue={todayIsoInIst()} />
          <Field label="Due date" name="due_date" type="date" />
          <Submit>Create invoice</Submit>
        </ActionForm>
      ) : null}
    </div>
  );
}
