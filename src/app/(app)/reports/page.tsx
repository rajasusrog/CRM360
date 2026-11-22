import { PageHeader, Panel } from "@/components/kit";
import { formatInr } from "@/lib/format";
import { requireStaff } from "@/lib/session";

export default async function ReportsPage() {
  const session = await requireStaff();
  const firmId = session.firm.id;
  const [dealsRes, stagesRes, leadsRes, tasksRes, invoicesRes] = await Promise.all([
    session.supabase.from("deals").select("amount, stage_id").eq("firm_id", firmId),
    session.supabase.from("pipeline_stages").select("id, name, is_won, is_lost").eq("firm_id", firmId).order("position"),
    session.supabase.from("leads").select("status, source").eq("firm_id", firmId),
    session.supabase.from("activities").select("id, due_at, completed_at, type").eq("firm_id", firmId).eq("type", "task"),
    session.supabase.from("invoices").select("total, status, invoice_date").eq("firm_id", firmId),
  ]);
  const stages = stagesRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const leads = leadsRes.data ?? [];
  const stageName = new Map(stages.map((stage) => [stage.id, stage]));
  const byStage = stages.map((stage) => ({
    name: stage.name,
    value: deals.filter((deal) => deal.stage_id === stage.id).reduce((sum, deal) => sum + Number(deal.amount), 0),
  }));
  const maxStage = Math.max(1, ...byStage.map((row) => row.value));
  const won = leads.filter((lead) => lead.status === "converted").length;
  const conversion = leads.length ? Math.round((won / leads.length) * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = (tasksRes.data ?? []).filter((task) => !task.completed_at && task.due_at && task.due_at.slice(0, 10) < today).length;
  const sources = new Map<string, number>();
  for (const lead of leads) sources.set(lead.source, (sources.get(lead.source) ?? 0) + 1);
  const months = new Map<string, number>();
  for (const invoice of invoicesRes.data ?? []) {
    if (invoice.status === "void" || invoice.status === "draft") continue;
    const key = String(invoice.invoice_date).slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + Number(invoice.total));
  }
  const monthRows = [...months.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxMonth = Math.max(1, ...monthRows.map(([, value]) => value));

  return (
    <div>
      <PageHeader eyebrow="Reports" title="How the practice is moving" lede={`${conversion}% of leads are converted. ${overdue} tasks are overdue.`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-2xl">Pipeline value</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {byStage.map((row) => (
              <li key={row.name} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2">
                <span>{row.name}</span>
                <span className="h-2 rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${(row.value / maxStage) * 100}%` }} /></span>
                <span>{formatInr(row.value, 0)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Leads by source</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {[...sources.entries()].map(([source, count]) => (
              <li key={source} className="flex justify-between capitalize"><span>{source}</span><span>{count}</span></li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">Open stages exclude {stages.filter((stage) => stage.is_won || stage.is_lost).map((stage) => stageName.get(stage.id)?.name).filter(Boolean).join(" and ") || "won and lost"}.</p>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Revenue by month</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {monthRows.map(([month, total]) => (
              <li key={month} className="grid grid-cols-[5rem_1fr_auto] items-center gap-2">
                <span>{month}</span>
                <span className="h-2 rounded-full bg-muted"><span className="block h-full bg-[var(--chart-2)]" style={{ width: `${(total / maxMonth) * 100}%` }} /></span>
                <span>{formatInr(total, 0)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Work waiting</h2>
          <p className="mt-3 font-display text-5xl">{overdue}</p>
          <p className="text-sm text-muted-foreground">tasks past their due time</p>
        </Panel>
      </div>
    </div>
  );
}
