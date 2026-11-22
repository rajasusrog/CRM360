import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Submit } from "@/components/action-form";
import { Field, SelectField } from "@/components/kit";
import { stateName } from "@/lib/constants";
import { formatDate, formatInr, todayIsoInIst } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { recordPayment } from "@/server/actions/practice";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const { data: invoice } = await session.supabase.from("invoices").select("*, accounts(name, address, city, gstin, state_code)").eq("id", id).maybeSingle();
  if (!invoice) notFound();
  const { data: payments } = await session.supabase.from("invoice_payments").select("*").eq("invoice_id", id).order("paid_on");
  const account = Array.isArray(invoice.accounts) ? invoice.accounts[0] : invoice.accounts;
  const paid = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const canWrite = session.profile.role !== "readonly";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,720px)_280px]">
      <article className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Tax invoice</p>
            <h1 className="font-display text-3xl">{invoice.invoice_number}</h1>
            <p className="mt-2 text-sm">{session.firm.name}</p>
            <p className="text-sm text-muted-foreground">{session.firm.address}</p>
            <p className="text-sm text-muted-foreground">{session.firm.city} · GSTIN {session.firm.gstin ?? "—"}</p>
          </div>
          <p className="rounded-full bg-muted px-3 py-1 text-xs tracking-wide uppercase">{invoice.status}</p>
        </div>
        <div className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Bill to</p>
            <p className="font-medium">{account?.name}</p>
            <p>{account?.address}</p>
            <p>{account?.city}</p>
            <p>GSTIN {account?.gstin ?? "Unregistered"}</p>
          </div>
          <div>
            <p>Invoice date {formatDate(invoice.invoice_date)}</p>
            <p>Due {formatDate(invoice.due_date)}</p>
            <p>Place of supply {stateName(invoice.place_of_supply)} ({invoice.place_of_supply})</p>
            <p>SAC {invoice.sac_code}</p>
          </div>
        </div>
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-3">{invoice.description}</td>
              <td className="py-3 text-right">{formatInr(Number(invoice.taxable_value))}</td>
            </tr>
          </tbody>
        </table>
        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>Taxable value</dt><dd>{formatInr(Number(invoice.taxable_value))}</dd></div>
          {Number(invoice.cgst) > 0 ? <div className="flex justify-between"><dt>CGST 9%</dt><dd>{formatInr(Number(invoice.cgst))}</dd></div> : null}
          {Number(invoice.sgst) > 0 ? <div className="flex justify-between"><dt>SGST 9%</dt><dd>{formatInr(Number(invoice.sgst))}</dd></div> : null}
          {Number(invoice.igst) > 0 ? <div className="flex justify-between"><dt>IGST 18%</dt><dd>{formatInr(Number(invoice.igst))}</dd></div> : null}
          <div className="flex justify-between border-t border-border pt-2 font-display text-xl"><dt>Total</dt><dd>{formatInr(Number(invoice.total))}</dd></div>
          <div className="flex justify-between text-muted-foreground"><dt>Received</dt><dd>{formatInr(paid)}</dd></div>
        </dl>
        {invoice.notes ? <p className="mt-6 text-sm text-muted-foreground">{invoice.notes}</p> : null}
        <p className="mt-8 text-xs text-muted-foreground">Amounts in INR, grouped in lakhs. Firm state {stateName(session.firm.state_code)}.</p>
      </article>
      <aside className="grid h-fit gap-4">
        <Link href={`/api/invoices/${invoice.id}/pdf`} className="rounded-lg bg-primary px-3 py-2 text-center text-sm text-primary-foreground">
          Download PDF
        </Link>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-display text-xl">Receipts</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {(payments ?? []).map((payment) => (
              <li key={payment.id} className="flex justify-between">
                <span>{formatDate(payment.paid_on)} · {payment.mode}</span>
                <span>{formatInr(Number(payment.amount))}</span>
              </li>
            ))}
          </ul>
          {canWrite && invoice.status !== "paid" ? (
            <ActionForm action={recordPayment} className="mt-3">
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <Field label="Amount" name="amount" type="number" required />
              <Field label="Paid on" name="paid_on" type="date" defaultValue={todayIsoInIst()} />
              <SelectField label="Mode" name="mode" defaultValue="neft">
                <option value="neft">NEFT</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
              </SelectField>
              <Field label="Reference" name="reference" />
              <Submit>Record payment</Submit>
            </ActionForm>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
