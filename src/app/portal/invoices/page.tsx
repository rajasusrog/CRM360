import { formatDate, formatInr } from "@/lib/format";
import { requireClient } from "@/lib/session";

export default async function PortalInvoices() {
  const session = await requireClient();
  const { data } = await session.supabase.from("invoices").select("id, invoice_number, invoice_date, total, status, due_date").eq("account_id", session.client.account_id).neq("status", "draft").order("invoice_date", { ascending: false });
  return (
    <div>
      <h1 className="font-display text-4xl">Invoices</h1>
      <ul className="mt-4 divide-y divide-border text-sm">
        {(data ?? []).map((invoice) => (
          <li key={invoice.id} className="flex justify-between py-2">
            <a className="underline" href={`/api/invoices/${invoice.id}/pdf`}>{invoice.invoice_number}</a>
            <span>{formatDate(invoice.invoice_date)} · {formatInr(Number(invoice.total))} · {invoice.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
