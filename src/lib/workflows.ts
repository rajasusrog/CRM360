export type WorkflowAction =
  | { type: "assign_owner"; userId: string }
  | { type: "create_task"; subject: string; dueInDays: number; ownerId?: string }
  | { type: "notify"; userId?: string; title: string; body: string };

export type WorkflowRule = {
  id: string;
  name: string;
  trigger_event: "lead.created" | "deal.stage_changed";
  actions: WorkflowAction[];
  active: boolean;
};

export function parseActions(value: unknown): WorkflowAction[] {
  if (!Array.isArray(value)) return [];
  const actions: WorkflowAction[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const action = item as Record<string, unknown>;
    if (action.type === "assign_owner" && typeof action.userId === "string") {
      actions.push({ type: "assign_owner", userId: action.userId });
    } else if (action.type === "create_task" && typeof action.subject === "string") {
      actions.push({
        type: "create_task",
        subject: action.subject,
        dueInDays: typeof action.dueInDays === "number" ? action.dueInDays : 1,
        ownerId: typeof action.ownerId === "string" ? action.ownerId : undefined,
      });
    } else if (action.type === "notify" && typeof action.title === "string") {
      actions.push({
        type: "notify",
        title: action.title,
        body: typeof action.body === "string" ? action.body : "",
        userId: typeof action.userId === "string" ? action.userId : undefined,
      });
    }
  }
  return actions;
}
