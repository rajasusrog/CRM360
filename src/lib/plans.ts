export type PlanId = "starter" | "growth" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  priceInr: number;
  seats: number;
  clients: number;
  workflows: boolean;
  portal: boolean;
  customFields: boolean;
  description: string;
};

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceInr: 0,
    seats: 3,
    clients: 40,
    workflows: false,
    portal: false,
    customFields: false,
    description: "Free forever for 1–3 person desks: pipeline, clients, GST invoices, and compliance calendar.",
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceInr: 999,
    seats: 8,
    clients: 250,
    workflows: true,
    portal: true,
    customFields: true,
    description: "Flat firm rate (~₹125/seat) with workflows, client portal, and custom fields for growing firms.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceInr: 2499,
    seats: 15,
    clients: 2000,
    workflows: true,
    portal: true,
    customFields: true,
    description: "Flat firm rate (~₹167/seat) for a 15-person practice, with room for 2,000 client files.",
  },
};

export function isPlanId(value: string): value is PlanId {
  return value === "starter" || value === "growth" || value === "pro";
}

export function featuresFor(firm: { plan: string; subscription_status: string; trial_ends_at: string | null }): Plan {
  const trialing =
    firm.subscription_status === "trialing" &&
    !!firm.trial_ends_at &&
    new Date(firm.trial_ends_at).getTime() > Date.now();
  if (trialing) return PLANS.growth;
  if (firm.subscription_status === "cancelled") return PLANS.starter;
  return isPlanId(firm.plan) ? PLANS[firm.plan] : PLANS.starter;
}

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}
