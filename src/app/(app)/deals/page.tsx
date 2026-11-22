import { ActionForm, Submit } from "@/components/action-form";
import { KanbanBoard } from "@/components/kanban-board";
import { Field, PageHeader, SelectField, TextAreaField } from "@/components/kit";
import { requireStaff } from "@/lib/session";
import { createDeal } from "@/server/actions/crm";

export default async function DealsPage() {
  const session = await requireStaff();
  const canWrite = session.profile.role !== "readonly";
  const [stagesRes, dealsRes, accountsRes, staffRes] = await Promise.all([
    session.supabase.from("pipeline_stages").select("*").eq("firm_id", session.firm.id).order("position"),
    session.supabase.from("deals").select("id, name, amount, stage_id, owner_id, account_id, accounts(name), profiles(full_name)").eq("firm_id", session.firm.id),
    session.supabase.from("accounts").select("id, name").eq("firm_id", session.firm.id).order("name"),
    session.supabase.from("profiles").select("id, full_name").eq("firm_id", session.firm.id),
  ]);
  const deals = (dealsRes.data ?? []).map((deal) => {
    const account = Array.isArray(deal.accounts) ? deal.accounts[0] : deal.accounts;
    const owner = Array.isArray(deal.profiles) ? deal.profiles[0] : deal.profiles;
    return {
      id: deal.id,
      name: deal.name,
      amount: Number(deal.amount),
      stage_id: deal.stage_id,
      account: account?.name ?? "No client",
      owner: owner?.full_name ?? "",
    };
  });

  return (
    <div>
      <PageHeader eyebrow="Pipeline" title="Deals" lede="Drag a card into another stage. A stage change can notify the owner." />
      <KanbanBoard stages={stagesRes.data ?? []} deals={deals} />
      {canWrite ? (
        <ActionForm action={createDeal} className="mt-6 max-w-3xl rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="font-display text-2xl">New deal</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" name="name" required />
            <Field label="Amount (INR, excl. GST)" name="amount" type="number" defaultValue={0} />
            <SelectField label="Stage" name="stage_id" defaultValue={stagesRes.data?.[0]?.id}>
              {(stagesRes.data ?? []).map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </SelectField>
            <SelectField label="Client" name="account_id">
              <option value="">None yet</option>
              {(accountsRes.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </SelectField>
            <SelectField label="Owner" name="owner_id" defaultValue={session.profile.id}>
              {(staffRes.data ?? []).map((person) => (
                <option key={person.id} value={person.id}>{person.full_name}</option>
              ))}
            </SelectField>
            <Field label="Expected close" name="expected_close" type="date" />
            <TextAreaField label="Notes" name="notes" />
          </div>
          <Submit>Add to the board</Submit>
        </ActionForm>
      ) : null}
    </div>
  );
}
