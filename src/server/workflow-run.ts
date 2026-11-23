import type { createClient } from "@/lib/supabase/server";
import { renderTemplate } from "@/lib/templates";
import { parseActions } from "@/lib/workflows";

type RunContext = {
  firmId: string;
  actorId: string;
  leadId?: string;
  relatedType?: string;
  relatedId?: string;
  link?: string;
  vars: Record<string, string>;
};

export async function runWorkflows(
  supabase: Pick<Awaited<ReturnType<typeof createClient>>, "from">,
  event: "lead.created" | "deal.stage_changed",
  context: RunContext,
) {
  const { data: rules } = await supabase
    .from("workflow_rules")
    .select("id, actions, active, trigger_event")
    .eq("firm_id", context.firmId)
    .eq("trigger_event", event)
    .eq("active", true);

  for (const rule of rules ?? []) {
    for (const action of parseActions(rule.actions)) {
      if (action.type === "assign_owner" && context.leadId) {
        await supabase.from("leads").update({ owner_id: action.userId }).eq("id", context.leadId).eq("firm_id", context.firmId);
      }
      if (action.type === "create_task") {
        const due = new Date();
        due.setDate(due.getDate() + action.dueInDays);
        await supabase.from("activities").insert({
          firm_id: context.firmId,
          type: "task",
          subject: renderTemplate(action.subject, context.vars),
          due_at: due.toISOString(),
          owner_id: action.ownerId ?? context.actorId,
          related_type: context.relatedType ?? null,
          related_id: context.relatedId ?? null,
        });
      }
      if (action.type === "notify") {
        const userId = action.userId ?? context.actorId;
        await supabase.from("notifications").insert({
          firm_id: context.firmId,
          user_id: userId,
          title: renderTemplate(action.title, context.vars),
          body: renderTemplate(action.body, context.vars),
          link: context.link ?? null,
        });
      }
    }
  }
}
