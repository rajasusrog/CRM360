import { GoogleGenAI, ThinkingLevel, type Schema } from "@google/genai";
import type { z } from "zod";
import {
  AI_LIMITS,
  AI_USER_WINDOW_LIMIT,
  AI_USER_WINDOW_MINUTES,
  canUseAiCopilot,
  dailyQuotaForPlan,
  resolveAiConfig,
  type AiFeature,
} from "@/lib/ai/config";
import type { CrmSupabaseClient, Firm, Profile } from "@/lib/auth-routing";
import { todayIsoInIst } from "@/lib/format";
import { getSession } from "@/lib/session";

export type AiFirmStatus = {
  schemaReady: boolean;
  providerConfigured: boolean;
  model: string;
  enabled: boolean;
  noticeAcceptedAt: string | null;
  dailyQuota: number;
  usedToday: number;
};

export type AiCaller =
  | {
      ok: true;
      supabase: CrmSupabaseClient;
      profile: Profile;
      firm: Firm;
    }
  | {
      ok: false;
      status: 401 | 403;
      error: string;
    };

export type GenerateJsonParams = {
  model: string;
  apiKey: string;
  systemInstruction: string;
  prompt: string;
  responseSchema: Schema;
  signal: AbortSignal;
};

export type GenerateJsonFn = (params: GenerateJsonParams) => Promise<string>;

export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|could not find the table/i.test(error.message ?? "")
  );
}

export function istDayStartUtcIso(now = new Date()): string {
  const todayIst = todayIsoInIst(now);
  return new Date(`${todayIst}T00:00:00+05:30`).toISOString();
}

export async function resolveAiCaller(): Promise<AiCaller> {
  const session = await getSession();
  if (!session.user) {
    return { ok: false, status: 401, error: "Sign in to use AI Copilot." };
  }
  if (session.state !== "staff" || !session.profile || !session.firm || session.profile.firm_id !== session.firm.id || session.issue) {
    return {
      ok: false,
      status: 403,
      error: session.issue?.message ?? "AI Copilot is available to active firm staff only.",
    };
  }
  if (!canUseAiCopilot(session.profile.role)) {
    return {
      ok: false,
      status: 403,
      error: "Read-only members cannot run AI Copilot actions.",
    };
  }
  return {
    ok: true,
    supabase: session.supabase,
    profile: session.profile,
    firm: session.firm,
  };
}

export async function getFirmAiStatus(supabase: CrmSupabaseClient, firm: Firm, now = new Date()): Promise<AiFirmStatus> {
  const config = resolveAiConfig();
  const dailyQuota = dailyQuotaForPlan(firm);

  const settingsRes = await supabase
    .from("ai_firm_settings")
    .select("enabled, notice_accepted_at")
    .eq("firm_id", firm.id)
    .maybeSingle();

  if (settingsRes.error && isMissingTableError(settingsRes.error)) {
    return {
      schemaReady: false,
      providerConfigured: config.configured,
      model: config.model,
      enabled: false,
      noticeAcceptedAt: null,
      dailyQuota,
      usedToday: 0,
    };
  }

  const dayStart = istDayStartUtcIso(now);
  const usageRes = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", firm.id)
    .eq("status", "ok")
    .gte("created_at", dayStart);

  return {
    schemaReady: !(usageRes.error && isMissingTableError(usageRes.error)),
    providerConfigured: config.configured,
    model: config.model,
    enabled: Boolean(settingsRes.data?.enabled && settingsRes.data?.notice_accepted_at),
    noticeAcceptedAt: settingsRes.data?.notice_accepted_at ?? null,
    dailyQuota,
    usedToday: usageRes.count ?? 0,
  };
}

function extractHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { status?: unknown; code?: unknown };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.code === "number") return candidate.code;
  return null;
}

function isTransientProviderError(error: unknown): boolean {
  const status = extractHttpStatus(error);
  if (status === 429 || status === 503 || status === 502 || status === 504) return true;
  if (error instanceof Error && /timeout|network|fetch failed|429|503/i.test(error.message)) {
    return true;
  }
  return false;
}

export async function defaultGeminiGenerateJson(params: GenerateJsonParams): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey: params.apiKey,
    httpOptions: {
      timeout: AI_LIMITS.timeoutMs,
      headers: { "User-Agent": "aistudio-build" },
    },
  });

  const response = await ai.models.generateContent({
    model: params.model,
    contents: params.prompt,
    config: {
      systemInstruction: params.systemInstruction,
      responseMimeType: "application/json",
      responseSchema: params.responseSchema,
      maxOutputTokens: AI_LIMITS.maxOutputTokens,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      abortSignal: params.signal,
    },
  });

  if (!response.text) {
    throw new Error("Empty model response");
  }
  return response.text;
}

async function logUsageEvent(
  supabase: CrmSupabaseClient,
  event: {
    firmId: string;
    userId: string;
    feature: AiFeature;
    requestId: string;
    status: "ok" | "rate_limited" | "provider_error" | "validation_error";
    modelId: string;
    inputChars: number;
    latencyMs: number | null;
  },
) {
  await supabase.from("ai_usage_events").insert({
    firm_id: event.firmId,
    user_id: event.userId,
    feature: event.feature,
    request_id: event.requestId,
    status: event.status,
    model_id: event.modelId,
    input_chars: Math.max(0, Math.round(event.inputChars)),
    latency_ms: event.latencyMs,
  });
}

export type RunAiResult<T> =
  | { ok: true; requestId: string; model: string; data: T }
  | { ok: false; requestId: string; status: number; error: string };

export async function runAiFeature<TSchema extends z.ZodTypeAny>(options: {
  supabase: CrmSupabaseClient;
  firm: Firm;
  profile: Profile;
  feature: AiFeature;
  systemInstruction: string;
  prompt: string;
  responseSchema: Schema;
  zodSchema: TSchema;
  requestSignal?: AbortSignal;
  generateJson?: GenerateJsonFn;
  now?: Date;
}): Promise<RunAiResult<z.infer<TSchema>>> {
  const requestId = crypto.randomUUID();
  const now = options.now ?? new Date();
  const config = resolveAiConfig();

  const settingsRes = await options.supabase
    .from("ai_firm_settings")
    .select("enabled, notice_accepted_at")
    .eq("firm_id", options.firm.id)
    .maybeSingle();

  if (settingsRes.error && isMissingTableError(settingsRes.error)) {
    return {
      ok: false,
      requestId,
      status: 503,
      error: "AI Copilot database tables are not provisioned yet. Apply the latest Supabase migration.",
    };
  }

  if (!settingsRes.data?.enabled || !settingsRes.data?.notice_accepted_at) {
    return {
      ok: false,
      requestId,
      status: 403,
      error: "AI Copilot is disabled for this firm. An owner or partner can enable it in Settings.",
    };
  }

  if (!config.configured || !config.apiKey) {
    return {
      ok: false,
      requestId,
      status: 503,
      error: "AI service is unavailable because GEMINI_API_KEY is not configured on the server.",
    };
  }

  const dailyQuota = dailyQuotaForPlan(options.firm);
  const dayStartIso = istDayStartUtcIso(now);
  const windowStartIso = new Date(now.getTime() - AI_USER_WINDOW_MINUTES * 60_000).toISOString();

  const [firmUsageRes, userWindowRes] = await Promise.all([
    options.supabase
      .from("ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("firm_id", options.firm.id)
      .eq("status", "ok")
      .gte("created_at", dayStartIso),
    options.supabase
      .from("ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", options.profile.id)
      .eq("status", "ok")
      .gte("created_at", windowStartIso),
  ]);

  if ((firmUsageRes.count ?? 0) >= dailyQuota) {
    await logUsageEvent(options.supabase, {
      firmId: options.firm.id,
      userId: options.profile.id,
      feature: options.feature,
      requestId,
      status: "rate_limited",
      modelId: config.model,
      inputChars: options.prompt.length,
      latencyMs: null,
    });
    return {
      ok: false,
      requestId,
      status: 429,
      error: `Daily AI quota reached (${dailyQuota} requests/day on your current plan). Try again tomorrow IST.`,
    };
  }

  if ((userWindowRes.count ?? 0) >= AI_USER_WINDOW_LIMIT) {
    await logUsageEvent(options.supabase, {
      firmId: options.firm.id,
      userId: options.profile.id,
      feature: options.feature,
      requestId,
      status: "rate_limited",
      modelId: config.model,
      inputChars: options.prompt.length,
      latencyMs: null,
    });
    return {
      ok: false,
      requestId,
      status: 429,
      error: `Rate limit reached (${AI_USER_WINDOW_LIMIT} requests per ${AI_USER_WINDOW_MINUTES} minutes). Wait a moment and retry.`,
    };
  }

  const generate = options.generateJson ?? defaultGeminiGenerateJson;
  const startedAt = Date.now();
  let rawText: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= AI_LIMITS.maxRetries; attempt++) {
    if (options.requestSignal?.aborted) {
      return { ok: false, requestId, status: 499, error: "Request cancelled." };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("AI request timed out")), AI_LIMITS.timeoutMs);
    const onParentAbort = () => controller.abort(options.requestSignal?.reason);
    options.requestSignal?.addEventListener("abort", onParentAbort, { once: true });

    try {
      rawText = await generate({
        model: config.model,
        apiKey: config.apiKey,
        systemInstruction: options.systemInstruction,
        prompt: options.prompt,
        responseSchema: options.responseSchema,
        signal: controller.signal,
      });
      lastError = null;
      clearTimeout(timer);
      options.requestSignal?.removeEventListener("abort", onParentAbort);
      break;
    } catch (error) {
      clearTimeout(timer);
      options.requestSignal?.removeEventListener("abort", onParentAbort);
      lastError = error;
      if (options.requestSignal?.aborted) {
        return { ok: false, requestId, status: 499, error: "Request cancelled." };
      }
      if (attempt < AI_LIMITS.maxRetries && isTransientProviderError(error)) {
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        continue;
      }
      break;
    }
  }

  const latencyMs = Date.now() - startedAt;

  if (lastError || rawText === null) {
    await logUsageEvent(options.supabase, {
      firmId: options.firm.id,
      userId: options.profile.id,
      feature: options.feature,
      requestId,
      status: "provider_error",
      modelId: config.model,
      inputChars: options.prompt.length,
      latencyMs,
    });
    return {
      ok: false,
      requestId,
      status: 503,
      error: "AI service is temporarily unavailable. Please retry in a moment.",
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    await logUsageEvent(options.supabase, {
      firmId: options.firm.id,
      userId: options.profile.id,
      feature: options.feature,
      requestId,
      status: "validation_error",
      modelId: config.model,
      inputChars: options.prompt.length,
      latencyMs,
    });
    return {
      ok: false,
      requestId,
      status: 502,
      error: "AI returned an invalid response format. Please retry.",
    };
  }

  const validated = options.zodSchema.safeParse(parsedJson);
  if (!validated.success) {
    await logUsageEvent(options.supabase, {
      firmId: options.firm.id,
      userId: options.profile.id,
      feature: options.feature,
      requestId,
      status: "validation_error",
      modelId: config.model,
      inputChars: options.prompt.length,
      latencyMs,
    });
    return {
      ok: false,
      requestId,
      status: 502,
      error: "AI output did not match the expected structure. Please retry.",
    };
  }

  await logUsageEvent(options.supabase, {
    firmId: options.firm.id,
    userId: options.profile.id,
    feature: options.feature,
    requestId,
    status: "ok",
    modelId: config.model,
    inputChars: options.prompt.length,
    latencyMs,
  });

  return {
    ok: true,
    requestId,
    model: config.model,
    data: validated.data,
  };
}
