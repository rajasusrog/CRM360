import Link from "next/link";
import { PageHeader, Panel } from "@/components/kit";
import { formatDate, formatInr, todayIsoInIst } from "@/lib/format";
import { featuresFor } from "@/lib/plans";
import { requireStaff } from "@/lib/session";

export default async function DashboardPage() {
  const session = await requireStaff();
  const today = todayIsoInIst();
  const supabase = session.supabase;
  const firmId = session.firm.id;
  const [stagesRes, dealsRes, leadsRes, filingsRes, tasksRes, invoicesRes] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name, is_won, is_lost").eq("firm_id", firmId).order("position"),
    supabase.from("deals").select("id, name, amount, stage_id").eq("firm_id", firmId),
    supabase.from("leads").select("id, status, source").eq("firm_id", firmId),
    supabase.from("compliance_filings").select("id, name, due_date, status, period_label, accounts(name)").eq("firm_id", firmId).neq("status", "filed").lte("due_date", today).order("due_date").limit(6),
    supabase.from("activities").select("id, subject, due_at, type").eq("firm_id", firmId).eq("type", "task").is("completed_at", null).order("due_at").limit(6),
    supabase.from("invoices").select("total, status, invoice_date").eq("firm_id", firmId).neq("status", "void"),
  ]);

  const stages = stagesRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const leads = leadsRes.data ?? [];
  const openStageIds = new Set(stages.filter((stage) => !stage.is_won && !stage.is_lost).map((stage) => stage.id));
  const pipeline = deals.filter((deal) => openStageIds.has(deal.stage_id)).reduce((sum, deal) => sum + Number(deal.amount), 0);
  const openLeads = leads.filter((lead) => !["converted", "unqualified"].includes(lead.status)).length;
  const unpaid = (invoicesRes.data ?? []).filter((invoice) => invoice.status === "sent" || invoice.status === "partial").reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const sources = new Map<string, number>();
  for (const lead of leads) sources.set(lead.source, (sources.get(lead.source) ?? 0) + 1);
  const maxSource = Math.max(1, ...sources.values());
  const plan = featuresFor(session.firm);
  const trialDays =
    session.firm.subscription_status === "trialing" && session.firm.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(session.firm.trial_ends_at).getTime() - Date.now()) / 86400000))
      : null;

  const monthTotals = new Map<string, number>();
  for (const invoice of invoicesRes.data ?? []) {
    if (invoice.status !== "paid" && invoice.status !== "partial") continue;
    const key = String(invoice.invoice_date).slice(0, 7);
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + Number(invoice.total));
  }
  const months = [...monthTotals.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxMonth = Math.max(1, ...months.map(([, value]) => value));

  return (
    <div>
      <PageHeader
        eyebrow={formatDate(today)}
        title={`${session.profile.full_name.split(" ")[0]}, the desk is open.`}
        lede={`${session.firm.name} · ${plan.name}${trialDays !== null ? ` trial, ${trialDays} days left` : ""}`}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Open pipeline", formatInr(pipeline, 0), "/deals"],
          ["Open leads", String(openLeads), "/leads"],
          ["Overdue filings", String(filingsRes.data?.length ?? 0), "/compliance"],
          ["Unpaid invoices", formatInr(unpaid, 0), "/invoices"],
        ].map(([label, value, href]) => (
          <Link key={label} href={href} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="mt-2 font-display text-3xl">{value}</p>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-2xl">Overdue filings</h2>
          <ul className="mt-3 divide-y divide-border">
            {(filingsRes.data ?? []).map((filing) => {
              const account = Array.isArray(filing.accounts) ? filing.accounts[0] : filing.accounts;
              return (
                <li key={filing.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    <span className="block">{account?.name ?? "Client"}</span>
                    <span className="text-muted-foreground">{filing.name} · {filing.period_label}</span>
                  </span>
                  <span className="text-destructive">{formatDate(filing.due_date)}</span>
                </li>
              );
            })}
            {(filingsRes.data ?? []).length === 0 ? <li className="py-4 text-sm text-muted-foreground">Nothing overdue.</li> : null}
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Open tasks</h2>
          <ul className="mt-3 divide-y divide-border">
            {(tasksRes.data ?? []).map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{task.subject}</span>
                <span className={task.due_at && task.due_at.slice(0, 10) < today ? "text-destructive" : "text-muted-foreground"}>{formatDate(task.due_at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Leads by source</h2>
          <ul className="mt-4 space-y-2">
            {[...sources.entries()].map(([source, count]) => (
              <li key={source} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2 text-sm">
                <span className="capitalize">{source}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full bg-primary" style={{ width: `${(count / maxSource) * 100}%` }} />
                </span>
                <span className="text-right">{count}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Collected by month</h2>
          <ul className="mt-4 space-y-2">
            {months.map(([month, total]) => (
              <li key={month} className="grid grid-cols-[5rem_1fr_auto] items-center gap-2 text-sm">
                <span>{month}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full bg-[var(--chart-2)]" style={{ width: `${(total / maxMonth) * 100}%` }} />
                </span>
                <span>{formatInr(total, 0)}</span>
              </li>
            ))}
            {months.length === 0 ? <li className="text-sm text-muted-foreground">No collections yet.</li> : null}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
