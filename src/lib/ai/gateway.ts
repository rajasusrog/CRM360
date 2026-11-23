import { GoogleGenAI, ThinkingLevel, type Schema } from "@google/genai";
import { z } from "zod";
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
import { createAdmin } from "@/lib/supabase/admin";

export const AI_RESERVATION_LEASE_MINUTES = 2;

export type AiFirmStatus = {
  schemaReady: boolean;
  providerConfigured: boolean;
  model: string;
  enabled: boolean;
  noticeAcceptedAt: string | null;
  dailyQuota: number;
  usedToday: number;
  statusError?: string | null;
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

const ReservationResponseSchema = z.object({
  allowed: z.boolean(),
  code: z.string(),
  event_id: z.string().uuid().optional(),
  lease_expires_at: z.string().optional(),
  daily_quota: z.number().optional(),
  used_today: z.number().optional(),
  burst_limit: z.number().optional(),
  burst_used: z.number().optional(),
  window_minutes: z.number().optional(),
  error: z.string().optional(),
});

const FinalizeResponseSchema = z.object({
  ok: z.boolean(),
  code: z.string().optional(),
  error: z.string().optional(),
  status: z.string().optional(),
  daily_quota: z.number().optional(),
  used_today: z.number().optional(),
});

export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|could not find the table/i.test(error.message ?? "")
  );
}

export function isMissingRpcError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42883" ||
    error.code === "PGRST202" ||
    /could not find the function|function .* does not exist/i.test(error.message ?? "")
  );
}

export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42703" || /column .* does not exist/i.test(error.message ?? "");
}

export function isProvisioningMissingError(error: { code?: string; message?: string } | null | undefined): boolean {
  return isMissingTableError(error) || isMissingRpcError(error) || isMissingColumnError(error);
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

  if (settingsRes.error) {
    if (isProvisioningMissingError(settingsRes.error)) {
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
    return {
      schemaReady: true,
      providerConfigured: config.configured,
      model: config.model,
      enabled: false,
      noticeAcceptedAt: null,
      dailyQuota,
      usedToday: 0,
      statusError: settingsRes.error.message || "Unable to load firm AI settings.",
    };
  }

  const nowIso = now.toISOString();
  const dayStart = istDayStartUtcIso(now);
  const leaseCutoffIso = new Date(now.getTime() - AI_RESERVATION_LEASE_MINUTES * 60_000).toISOString();
  const usageRes = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", firm.id)
    .gte("created_at", dayStart)
    .or(
      `status.eq.ok,and(status.eq.reserved,lease_expires_at.gt.${nowIso}),and(status.eq.reserved,lease_expires_at.is.null,created_at.gte.${leaseCutoffIso})`,
    );

  if (usageRes.error) {
    if (isProvisioningMissingError(usageRes.error)) {
      return {
        schemaReady: false,
        providerConfigured: config.configured,
        model: config.model,
        enabled: false,
        noticeAcceptedAt: settingsRes.data?.notice_accepted_at ?? null,
        dailyQuota,
        usedToday: 0,
      };
    }
    return {
      schemaReady: true,
      providerConfigured: config.configured,
      model: config.model,
      enabled: false,
      noticeAcceptedAt: settingsRes.data?.notice_accepted_at ?? null,
      dailyQuota,
      usedToday: 0,
      statusError: usageRes.error.message || "Unable to verify today's AI usage quota.",
    };
  }

  return {
    schemaReady: true,
    providerConfigured: config.configured,
    model: config.model,
    enabled: Boolean(settingsRes.data?.enabled && settingsRes.data?.notice_accepted_at),
    noticeAcceptedAt: settingsRes.data?.notice_accepted_at ?? null,
    dailyQuota,
    usedToday: usageRes.count ?? 0,
    statusError: null,
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

async function finalizeAiUsage(
  adminSupabase: CrmSupabaseClient,
  params: {
    eventId: string;
    firmId: string;
    userId: string;
    status: "ok" | "provider_error" | "validation_error" | "aborted";
    latencyMs: number | null;
  },
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  const { data, error } = await adminSupabase.rpc("crmpro_finalize_ai_usage", {
    p_event_id: params.eventId,
    p_firm_id: params.firmId,
    p_user_id: params.userId,
    p_status: params.status,
    p_latency_ms: params.latencyMs === null ? null : Math.max(0, Math.round(params.latencyMs)),
  });

  if (error) {
    return {
      ok: false,
      statusCode: 503,
      error: isProvisioningMissingError(error)
        ? "AI Copilot database tables or server accounting RPCs are not provisioned yet. Apply the latest Supabase migration."
        : error.message || "Failed to finalize AI usage event.",
    };
  }

  const parsed = FinalizeResponseSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, statusCode: 503, error: "Unexpected accounting finalization response from database." };
  }

  if (!parsed.data.ok) {
    if (parsed.data.code === "quota_exceeded_after_lease") {
      return {
        ok: false,
        statusCode: 429,
        error:
          parsed.data.error ??
          "Daily AI quota filled before this slow request completed. Please retry tomorrow IST.",
      };
    }
    return {
      ok: false,
      statusCode: 503,
      error: parsed.data.error ?? "AI usage reservation could not be finalized.",
    };
  }

  return { ok: true };
}

export type RunAiResult<T> =
  | { ok: true; requestId: string; model: string; data: T }
  | { ok: false; requestId: string; status: number; error: string };

export async function runAiFeature<TSchema extends z.ZodTypeAny>(options: {
  supabase: CrmSupabaseClient;
  adminSupabase?: CrmSupabaseClient;
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
  const config = resolveAiConfig();

  if (!config.configured || !config.apiKey) {
    return {
      ok: false,
      requestId,
      status: 503,
      error: "AI service is unavailable because GEMINI_API_KEY is not configured on the server.",
    };
  }

  let adminSupabase: CrmSupabaseClient;
  try {
    adminSupabase = options.adminSupabase ?? (createAdmin() as unknown as CrmSupabaseClient);
  } catch {
    return {
      ok: false,
      requestId,
      status: 503,
      error: "AI usage accounting is unavailable because server Supabase service credentials are not configured.",
    };
  }

  const reserveRes = await options.supabase.rpc("crmpro_reserve_ai_quota", {
    p_feature: options.feature,
    p_request_id: requestId,
    p_model_id: config.model,
    p_input_chars: Math.max(0, Math.round(options.prompt.length)),
  });

  if (reserveRes.error) {
    if (isProvisioningMissingError(reserveRes.error)) {
      return {
        ok: false,
        requestId,
        status: 503,
        error: "AI Copilot database tables or atomic quota RPCs are not provisioned yet. Apply the latest Supabase migration.",
      };
    }
    return {
      ok: false,
      requestId,
      status: 503,
      error: "Unable to verify AI quota in the database. Please retry in a moment.",
    };
  }

  const parsedReservation = ReservationResponseSchema.safeParse(reserveRes.data);
  if (!parsedReservation.success) {
    return {
      ok: false,
      requestId,
      status: 503,
      error: "Unexpected quota reservation response from database.",
    };
  }

  const reservation = parsedReservation.data;
  if (!reservation.allowed) {
    if (reservation.code === "unauthorized") {
      return {
        ok: false,
        requestId,
        status: 401,
        error: reservation.error ?? "Sign in to use AI Copilot.",
      };
    }
    if (reservation.code === "forbidden" || reservation.code === "disabled") {
      return {
        ok: false,
        requestId,
        status: 403,
        error:
          reservation.error ??
          "AI Copilot is disabled for this firm. An owner or partner can enable it in Settings.",
      };
    }
    if (reservation.code === "daily_quota_exceeded") {
      const limit = reservation.daily_quota ?? dailyQuotaForPlan(options.firm);
      return {
        ok: false,
        requestId,
        status: 429,
        error:
          reservation.error ??
          `Daily AI quota reached (${limit} requests/day on your current plan). Try again tomorrow IST.`,
      };
    }
    if (reservation.code === "burst_limit_exceeded") {
      const limit = reservation.burst_limit ?? AI_USER_WINDOW_LIMIT;
      const windowMinutes = reservation.window_minutes ?? AI_USER_WINDOW_MINUTES;
      return {
        ok: false,
        requestId,
        status: 429,
        error:
          reservation.error ??
          `Rate limit reached (${limit} requests per ${windowMinutes} minutes). Wait a moment and retry.`,
      };
    }
    return {
      ok: false,
      requestId,
      status: 503,
      error: reservation.error ?? "Unable to reserve AI quota.",
    };
  }

  if (!reservation.event_id) {
    return {
      ok: false,
      requestId,
      status: 503,
      error: "Database quota reservation did not return an event identifier.",
    };
  }

  const eventId = reservation.event_id;
  const generate = options.generateJson ?? defaultGeminiGenerateJson;
  const startedAt = Date.now();
  let rawText: string | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= AI_LIMITS.maxRetries; attempt++) {
    if (options.requestSignal?.aborted) {
      await finalizeAiUsage(adminSupabase, {
        eventId,
        firmId: options.firm.id,
        userId: options.profile.id,
        status: "aborted",
        latencyMs: Date.now() - startedAt,
      });
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
        await finalizeAiUsage(adminSupabase, {
          eventId,
          firmId: options.firm.id,
          userId: options.profile.id,
          status: "aborted",
          latencyMs: Date.now() - startedAt,
        });
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
    await finalizeAiUsage(adminSupabase, {
      eventId,
      firmId: options.firm.id,
      userId: options.profile.id,
      status: "provider_error",
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
    await finalizeAiUsage(adminSupabase, {
      eventId,
      firmId: options.firm.id,
      userId: options.profile.id,
      status: "validation_error",
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
    await finalizeAiUsage(adminSupabase, {
      eventId,
      firmId: options.firm.id,
      userId: options.profile.id,
      status: "validation_error",
      latencyMs,
    });
    return {
      ok: false,
      requestId,
      status: 502,
      error: "AI output did not match the expected structure. Please retry.",
    };
  }

  const finalized = await finalizeAiUsage(adminSupabase, {
    eventId,
    firmId: options.firm.id,
    userId: options.profile.id,
    status: "ok",
    latencyMs,
  });
  if (!finalized.ok) {
    return {
      ok: false,
      requestId,
      status: finalized.statusCode ?? 503,
      error: finalized.error ?? "Could not finalize AI usage accounting in the database. Please retry.",
    };
  }

  return {
    ok: true,
    requestId,
    model: config.model,
    data: validated.data,
  };
}
