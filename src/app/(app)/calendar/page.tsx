import Link from "next/link";
import { PageHeader } from "@/components/kit";
import { requireStaff } from "@/lib/session";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await requireStaff();
  const params = await searchParams;
  const now = new Date();
  const month = params.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  const [{ data: activities }, { data: filings }] = await Promise.all([
    session.supabase.from("activities").select("id, subject, due_at, type").eq("firm_id", session.firm.id).gte("due_at", `${start}T00:00:00+05:30`).lte("due_at", `${end}T23:59:59+05:30`),
    session.supabase.from("compliance_filings").select("id, name, due_date, accounts(name)").eq("firm_id", session.firm.id).gte("due_date", start).lte("due_date", end).limit(200),
  ]);
  const byDay = new Map<string, string[]>();
  for (const activity of activities ?? []) {
    const day = activity.due_at?.slice(0, 10);
    if (!day) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), activity.subject]);
  }
  for (const filing of filings ?? []) {
    const account = Array.isArray(filing.accounts) ? filing.accounts[0] : filing.accounts;
    byDay.set(filing.due_date, [...(byDay.get(filing.due_date) ?? []), `${filing.name} · ${account?.name ?? ""}`]);
  }
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);

  return (
    <div>
      <PageHeader
        eyebrow="IST"
        title="Calendar"
        lede="Tasks and filing due dates for the month."
        action={<div className="flex gap-2 text-sm"><Link className="rounded-lg border px-3 py-2" href={`/calendar?month=${previous}`}>Previous</Link><Link className="rounded-lg border px-3 py-2" href={`/calendar?month=${next}`}>Next</Link></div>}
      />
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="px-1 py-1 text-muted-foreground">{day}</div>)}
        {cells.map((day, index) => {
          const key = day ? `${month}-${String(day).padStart(2, "0")}` : `blank-${index}`;
          const items = day ? byDay.get(key) ?? [] : [];
          return (
            <div key={key} className="min-h-24 rounded-lg bg-card p-1 ring-1 ring-foreground/10">
              <p className="text-muted-foreground">{day ?? ""}</p>
              {items.slice(0, 3).map((item) => <p key={item} className="mt-1 truncate text-[11px]">{item}</p>)}
              {items.length > 3 ? <p className="text-[11px] text-muted-foreground">+{items.length - 3}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
