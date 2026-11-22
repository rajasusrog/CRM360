import { formatDate } from "@/lib/format";
import { requireClient } from "@/lib/session";

export default async function PortalFilings() {
  const session = await requireClient();
  const { data } = await session.supabase.from("compliance_filings").select("name, period_label, due_date, status, acknowledgement_no").eq("account_id", session.client.account_id).order("due_date");
  return (
    <div>
      <h1 className="font-display text-4xl">Filings</h1>
      <ul className="mt-4 divide-y divide-border text-sm">
        {(data ?? []).map((filing) => (
          <li key={filing.name + filing.due_date} className="flex justify-between gap-3 py-2">
            <span>{filing.name} · {filing.period_label}</span>
            <span>{formatDate(filing.due_date)} · {filing.status}{filing.acknowledgement_no ? ` · ${filing.acknowledgement_no}` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
