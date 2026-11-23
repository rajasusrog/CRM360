import { isPlanId, type PlanId } from "@/lib/plans";

export const AI_FEATURES = ["briefing", "follow_up", "notes_to_tasks"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const DEFAULT_GEMINI_MODEL = "gemini-4-hydrogen";

export const AI_DAILY_QUOTAS: Record<PlanId, number> = {
  starter: 25,
  growth: 150,
  pro: 500,
};

export const AI_USER_WINDOW_MINUTES = 10;
export const AI_USER_WINDOW_LIMIT = 10;

export const AI_LIMITS = {
  maxNotesChars: 12_000,
  maxPurposeChars: 500,
  maxFeedbackChars: 300,
  maxOutputTokens: 2048,
  timeoutMs: 20_000,
  maxRetries: 1,
} as const;

export const AI_EXTERNAL_NOTICE =
  "When enabled, Unikorn360 sends selected CRM records—which may include confidential client names, engagement or deal details, compliance due dates, invoice totals, or personal and business information in pasted notes—to Google Gemini over TLS to draft briefings, follow-ups, and proposed tasks. Prompts and AI outputs are not stored in the CRM database; request outcomes, latency, and token usage counts are logged for quota and cost tracking.";

export type AiServerConfig = {
  configured: boolean;
  apiKey: string | null;
  model: string;
};

export function resolveAiConfig(): AiServerConfig {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || null;
  const rawModel = process.env.GEMINI_MODEL?.trim();
  const model = rawModel && /^[a-zA-Z0-9._-]+$/.test(rawModel) ? rawModel : DEFAULT_GEMINI_MODEL;
  return {
    configured: Boolean(apiKey),
    apiKey,
    model,
  };
}

export function dailyQuotaForPlan(firm: {
  plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
}): number {
  const trialing =
    firm.subscription_status === "trialing" &&
    !!firm.trial_ends_at &&
    new Date(firm.trial_ends_at).getTime() > Date.now();
  if (trialing) return AI_DAILY_QUOTAS.growth;
  if (firm.subscription_status === "cancelled") return AI_DAILY_QUOTAS.starter;
  return isPlanId(firm.plan) ? AI_DAILY_QUOTAS[firm.plan] : AI_DAILY_QUOTAS.starter;
}

export function canManageAiSettings(role: string): boolean {
  return role === "owner" || role === "partner";
}

export function canUseAiCopilot(role: string): boolean {
  return role === "owner" || role === "partner" || role === "staff";
}
