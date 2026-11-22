import { ActionForm, Submit } from "@/components/action-form";
import { Field, PageHeader, SelectField, TextAreaField } from "@/components/kit";
import { formatDateTime, todayIsoInIst } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { completeActivity, createActivity } from "@/server/actions/crm";

export default async function ActivitiesPage() {
  const session = await requireStaff();
  const canWrite = session.profile.role !== "readonly";
  const today = todayIsoInIst();
  const [{ data: activities }, { data: staff }] = await Promise.all([
    session.supabase.from("activities").select("*").eq("firm_id", session.firm.id).order("due_at", { ascending: true, nullsFirst: false }).limit(40),
    session.supabase.from("profiles").select("id, full_name").eq("firm_id", session.firm.id),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <PageHeader eyebrow="Follow-up" title="Activities" lede="Tasks, calls, meetings, and notes. Overdue tasks stay marked until someone completes them." />
        <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
          {(activities ?? []).map((activity) => {
            const late = activity.type === "task" && !activity.completed_at && activity.due_at && activity.due_at.slice(0, 10) < today;
            return (
              <li key={activity.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
                <div>
                  <p className="capitalize text-muted-foreground">{activity.type}</p>
                  <p className={activity.completed_at ? "line-through" : ""}>{activity.subject}</p>
                  {activity.body ? <p className="text-muted-foreground">{activity.body}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className={late ? "text-destructive" : "text-muted-foreground"}>{formatDateTime(activity.due_at)}</span>
                  {canWrite && activity.type === "task" ? (
                    <form action={completeActivity}>
                      <input type="hidden" name="id" value={activity.id} />
                      <input type="hidden" name="done" value={activity.completed_at ? "" : "on"} />
                      <button className="underline" type="submit">{activity.completed_at ? "Reopen" : "Done"}</button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {canWrite ? (
        <ActionForm action={createActivity} className="h-fit rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="font-display text-2xl">Add</p>
          <SelectField label="Type" name="type" defaultValue="task">
            <option value="task">Task</option>
            <option value="call">Call</option>
            <option value="meeting">Meeting</option>
            <option value="note">Note</option>
          </SelectField>
          <Field label="Subject" name="subject" required />
          <TextAreaField label="Detail" name="body" />
          <Field label="Due" name="due_at" type="datetime-local" />
          <SelectField label="Owner" name="owner_id" defaultValue={session.profile.id}>
            {(staff ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
          </SelectField>
          <Submit>Save activity</Submit>
        </ActionForm>
      ) : null}
    </div>
  );
}
