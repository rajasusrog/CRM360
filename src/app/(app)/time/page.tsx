import { ActionForm, Submit } from "@/components/action-form";
import { CheckField, Field, PageHeader, SelectField } from "@/components/kit";
import { formatDate } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { createTimeEntry } from "@/server/actions/practice";

export default async function TimePage() {
  const session = await requireStaff();
  const canWrite = session.profile.role !== "readonly";
  const [{ data: entries }, { data: accounts }, { data: staff }] = await Promise.all([
    session.supabase.from("time_entries").select("id, work_date, minutes, description, billable, accounts(name), profiles(full_name)").eq("firm_id", session.firm.id).order("work_date", { ascending: false }).limit(40),
    session.supabase.from("accounts").select("id, name").eq("firm_id", session.firm.id).order("name"),
    session.supabase.from("profiles").select("id, full_name").eq("firm_id", session.firm.id),
  ]);
  const minutes = (entries ?? []).reduce((sum, entry) => sum + entry.minutes, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <PageHeader eyebrow="Time" title="Hours on the file" lede={`${Math.round(minutes / 60)} hours in the latest entries.`} />
        <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
          {(entries ?? []).map((entry) => {
            const account = Array.isArray(entry.accounts) ? entry.accounts[0] : entry.accounts;
            const person = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
            return (
              <li key={entry.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
                <span>{formatDate(entry.work_date)} · {person?.full_name} · {account?.name ?? "Internal"} · {entry.description}</span>
                <span>{entry.minutes} min{entry.billable ? "" : " · non-billable"}</span>
              </li>
            );
          })}
        </ul>
      </div>
      {canWrite ? (
        <ActionForm action={createTimeEntry} className="h-fit rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="font-display text-2xl">Log time</p>
          <SelectField label="Person" name="user_id" defaultValue={session.profile.id}>
            {(staff ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
          </SelectField>
          <SelectField label="Client" name="account_id">
            <option value="">Internal</option>
            {(accounts ?? []).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </SelectField>
          <Field label="Date" name="work_date" type="date" />
          <Field label="Minutes" name="minutes" type="number" required />
          <Field label="Description" name="description" />
          <CheckField label="Billable" name="billable" defaultChecked />
          <Submit>Save</Submit>
        </ActionForm>
      ) : null}
    </div>
  );
}
