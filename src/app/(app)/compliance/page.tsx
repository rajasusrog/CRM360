import Link from "next/link";
import { ActionForm, Submit } from "@/components/action-form";
import { Field, PageHeader, Panel } from "@/components/kit";
import { currentFyStartYear, formatDate, todayIsoInIst } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { generateCompliance, updateFiling } from "@/server/actions/practice";

export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ status?: string; month?: string }> }) {
  const session = await requireStaff();
  const params = await searchParams;
  const today = todayIsoInIst();
  const month = params.month || today.slice(0, 7);
  const canWrite = session.profile.role !== "readonly";
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
  let query = session.supabase
    .from("compliance_filings")
    .select("id, name, due_date, status, period_label, rule_code, account_id, acknowledgement_no, assigned_to, accounts(name)")
    .eq("firm_id", session.firm.id)
    .gte("due_date", `${month}-01`)
    .lte("due_date", monthEnd)
    .order("due_date");
  if (params.status) query = query.eq("status", params.status);
  const [{ data: filings }, overdueResult, { data: staff }] = await Promise.all([
    query,
    session.supabase.from("compliance_filings").select("id", { count: "exact", head: true }).eq("firm_id", session.firm.id).neq("status", "filed").lt("due_date", today),
    session.supabase.from("profiles").select("id, full_name").eq("firm_id", session.firm.id),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="Filing calendar"
        lede={`${overdueResult.count ?? 0} overdue across the firm. Due dates come from the rules table, not from code.`}
        action={
          <div className="flex gap-2 text-sm">
            <Link className="rounded-lg border border-border px-3 py-2" href={`/compliance?month=${previous}`}>Previous</Link>
            <Link className="rounded-lg border border-border px-3 py-2" href={`/compliance?month=${next}`}>Next</Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {["", "pending", "in_progress", "filed"].map((status) => (
          <Link key={status || "all"} href={`/compliance?month=${month}${status ? `&status=${status}` : ""}`} className="rounded-full bg-card px-3 py-1 ring-1 ring-foreground/10">
            {status || "All"}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Return</th>
              <th className="px-3 py-2 font-medium">Period</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(filings ?? []).map((filing) => {
              const account = Array.isArray(filing.accounts) ? filing.accounts[0] : filing.accounts;
              const late = filing.status !== "filed" && filing.due_date < today;
              return (
                <tr key={filing.id} className="border-t border-border align-top">
                  <td className={`px-3 py-2 ${late ? "text-destructive" : ""}`}>{formatDate(filing.due_date)}</td>
                  <td className="px-3 py-2"><Link href={`/clients/${filing.account_id}`}>{account?.name}</Link></td>
                  <td className="px-3 py-2">{filing.name}</td>
                  <td className="px-3 py-2">{filing.period_label}</td>
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <ActionForm action={updateFiling} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={filing.id} />
                        <select name="status" defaultValue={filing.status} className="h-8 rounded-md border border-input bg-card px-2 text-xs">
                          <option value="pending">Pending</option>
                          <option value="in_progress">In progress</option>
                          <option value="filed">Filed</option>
                        </select>
                        <select name="assigned_to" defaultValue={filing.assigned_to ?? ""} className="h-8 max-w-36 rounded-md border border-input bg-card px-2 text-xs">
                          <option value="">Unassigned</option>
                          {(staff ?? []).map((person) => (
                            <option key={person.id} value={person.id}>{person.full_name}</option>
                          ))}
                        </select>
                        <button className="text-xs underline" type="submit">Save</button>
                      </ActionForm>
                    ) : (
                      filing.status
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(filings ?? []).length === 0 ? <p className="px-3 py-8 text-sm text-muted-foreground">No filings in this month. Generate the financial year if this client file is new.</p> : null}
      </div>
      {canWrite ? (
        <Panel className="mt-6 max-w-xl">
          <h2 className="font-display text-2xl">Generate a financial year</h2>
          <p className="mt-1 text-sm text-muted-foreground">Adds missing periods. Rows that already exist, including filed ones, are left alone.</p>
          <ActionForm action={generateCompliance} className="mt-3">
            <Field label="FY start year" name="fy_start_year" type="number" defaultValue={currentFyStartYear()} />
            <Submit>Generate for every active client</Submit>
          </ActionForm>
        </Panel>
      ) : null}
    </div>
  );
}
