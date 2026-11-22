import Link from "next/link";
import { formatDate, formatInr } from "@/lib/format";
import { todayIsoInIst } from "@/lib/format";
import { requireClient } from "@/lib/session";

export default async function PortalHome() {
  const session = await requireClient();
  const today = todayIsoInIst();
  const [{ data: account }, { data: filings }, { data: requests }, { data: invoices }] = await Promise.all([
    session.supabase.from("accounts").select("name").eq("id", session.client.account_id).maybeSingle(),
    session.supabase.from("compliance_filings").select("name, due_date, status, period_label").eq("account_id", session.client.account_id).neq("status", "filed").order("due_date").limit(5),
    session.supabase.from("document_requests").select("title, status").eq("account_id", session.client.account_id).eq("status", "requested"),
    session.supabase.from("invoices").select("invoice_number, total, status, due_date").eq("account_id", session.client.account_id).in("status", ["sent", "partial"]).limit(5),
  ]);

  return (
    <div>
      <h1 className="font-display text-4xl">{account?.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">What {session.firm.name} is waiting on, as of {formatDate(today)}.</p>
      <section className="mt-6">
        <h2 className="font-display text-2xl">Documents still needed</h2>
        <ul className="mt-2 text-sm">{(requests ?? []).map((request) => <li key={request.title}>{request.title}</li>)}{(requests ?? []).length === 0 ? <li>Nothing outstanding.</li> : null}</ul>
      </section>
      <section className="mt-6">
        <h2 className="font-display text-2xl">Open filings</h2>
        <ul className="mt-2 text-sm">
          {(filings ?? []).map((filing) => <li key={filing.name + filing.due_date}>{filing.name} · {filing.period_label} · {formatDate(filing.due_date)}</li>)}
        </ul>
        <Link className="mt-2 inline-block text-sm underline" href="/portal/filings">All filings</Link>
      </section>
      <section className="mt-6">
        <h2 className="font-display text-2xl">Invoices to pay</h2>
        <ul className="mt-2 text-sm">
          {(invoices ?? []).map((invoice) => <li key={invoice.invoice_number}>{invoice.invoice_number} · {formatInr(Number(invoice.total))} · due {formatDate(invoice.due_date)}</li>)}
        </ul>
      </section>
    </div>
  );
}
