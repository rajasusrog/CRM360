import { notFound } from "next/navigation";
import { ActionForm, Submit } from "@/components/action-form";
import { FollowUpDraftPanel } from "@/components/ai/follow-up-draft-panel";
import { NotesToTasksPanel } from "@/components/ai/notes-to-tasks-panel";
import { Field, SelectField, TextAreaField } from "@/components/kit";
import { canUseAiCopilot } from "@/lib/ai/config";
import { getFirmAiStatus } from "@/lib/ai/gateway";
import { ENTITY_TYPES, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/constants";
import { formatDateTime, formatIndianMobile, whatsAppLink } from "@/lib/format";
import { requireStaff } from "@/lib/session";
import { convertLead, deleteLead, updateLead } from "@/server/actions/crm";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const { data: lead } = await session.supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) notFound();
  const [{ data: staff }, { data: leadActivities }, aiStatus] = await Promise.all([
    session.supabase.from("profiles").select("id, full_name, role").eq("firm_id", session.firm.id),
    session.supabase
      .from("activities")
      .select("id, type, subject")
      .eq("firm_id", session.firm.id)
      .eq("related_type", "lead")
      .eq("related_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
    getFirmAiStatus(session.supabase, session.firm),
  ]);
  const canWrite = session.profile.role !== "readonly";
  const canUseAi = canUseAiCopilot(session.profile.role);
  const aiStaff = (staff ?? []).filter((person) => person.role !== "readonly");
  const leadDisplayName = `${lead.first_name} ${lead.last_name ?? ""}`.trim();
  const wa = lead.phone ? whatsAppLink(lead.phone, `Hello ${lead.first_name}, this is ${session.firm.name}.`) : null;

  return (
    <div className="max-w-3xl">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{lead.source} · {lead.status}</p>
      <h1 className="font-display text-4xl">{lead.first_name} {lead.last_name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{lead.company} · {formatIndianMobile(lead.phone)} · added {formatDateTime(lead.created_at)}</p>
      {wa ? <a className="mt-2 inline-block text-sm underline" href={wa} target="_blank" rel="noreferrer">Open WhatsApp</a> : null}
      {canWrite ? (
        <div className="mt-6 grid gap-6">
          <ActionForm action={updateLead} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <input type="hidden" name="id" value={lead.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name" name="first_name" defaultValue={lead.first_name} required />
              <Field label="Last name" name="last_name" defaultValue={lead.last_name} />
              <Field label="Company" name="company" defaultValue={lead.company} />
              <Field label="Phone" name="phone" defaultValue={lead.phone} />
              <Field label="Email" name="email" defaultValue={lead.email} />
              <Field label="City" name="city" defaultValue={lead.city} />
              <SelectField label="Source" name="source" defaultValue={lead.source}>
                {LEAD_SOURCES.map((source) => <option key={source}>{source}</option>)}
              </SelectField>
              <SelectField label="Status" name="status" defaultValue={lead.status}>
                {LEAD_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </SelectField>
              <SelectField label="Owner" name="owner_id" defaultValue={lead.owner_id}>
                {(staff ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
              </SelectField>
            </div>
            <TextAreaField label="Notes" name="notes" defaultValue={lead.notes} />
            <Submit>Save</Submit>
          </ActionForm>
          {lead.status !== "converted" ? (
            <ActionForm action={convertLead} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <input type="hidden" name="id" value={lead.id} />
              <p className="font-display text-2xl">Convert to a client</p>
              <SelectField label="Entity type" name="entity_type" defaultValue="proprietorship">
                {ENTITY_TYPES.map((entity) => <option key={entity.value} value={entity.value}>{entity.label}</option>)}
              </SelectField>
              <Submit>Convert</Submit>
            </ActionForm>
          ) : null}
          <form action={deleteLead}>
            <input type="hidden" name="id" value={lead.id} />
            <button className="text-sm text-destructive underline" type="submit">Delete lead</button>
          </form>
        </div>
      ) : null}
      {canUseAi ? (
        <div className="mt-6 grid gap-6">
          <FollowUpDraftPanel
            entityType="lead"
            entityId={lead.id}
            entityName={leadDisplayName}
            activities={leadActivities ?? []}
            recipientEmail={lead.email}
            recipientPhone={lead.phone}
            aiEnabled={aiStatus.enabled}
            canUseAi={canUseAi}
          />
          <NotesToTasksPanel
            relatedType="lead"
            relatedId={lead.id}
            staff={aiStaff}
            aiEnabled={aiStatus.enabled}
            canUseAi={canUseAi}
          />
        </div>
      ) : null}
    </div>
  );
}
