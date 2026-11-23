"use server";

import { revalidatePath } from "next/cache";
import { canManageAiSettings } from "@/lib/ai/config";
import { isMissingTableError } from "@/lib/ai/gateway";
import { PLANS, featuresFor, isPlanId, type PlanId } from "@/lib/plans";
import { validateGstin } from "@/lib/gst/gstin";
import { normalizeIndianMobile } from "@/lib/format";
import { requireOwner, requireWriter } from "@/lib/session";
import { createAdmin } from "@/lib/supabase/admin";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function updateFirm(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  if (session.profile.role === "staff") return { error: "Partners and the owner edit the firm profile." };
  const gstinRaw = text(formData, "gstin");
  if (gstinRaw && !validateGstin(gstinRaw).ok) {
    const check = validateGstin(gstinRaw);
    if (!check.ok) return { error: check.reason };
  }
  const phoneRaw = text(formData, "phone");
  const phone = phoneRaw ? normalizeIndianMobile(phoneRaw) : null;
  if (phoneRaw && !phone) return { error: "Enter a 10-digit Indian mobile." };
  const { error } = await session.supabase
    .from("firms")
    .update({
      name: text(formData, "name"),
      city: text(formData, "city") || null,
      state_code: text(formData, "state_code") || "33",
      address: text(formData, "address") || null,
      pincode: text(formData, "pincode") || null,
      phone,
      email: text(formData, "email") || null,
      gstin: gstinRaw ? gstinRaw.toUpperCase() : null,
      pan: text(formData, "pan").toUpperCase() || null,
      sac_code: text(formData, "sac_code") || "998222",
    })
    .eq("id", session.firm.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
}

export async function inviteStaff(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  if (!["owner", "partner"].includes(session.profile.role)) return { error: "Only a partner or the owner can invite." };
  const email = text(formData, "email").toLowerCase();
  const role = text(formData, "role");
  if (!email || !["partner", "staff", "readonly"].includes(role)) return { error: "Email and role are required." };
  const features = featuresFor(session.firm);
  const { count } = await session.supabase.from("profiles").select("id", { count: "exact", head: true }).eq("firm_id", session.firm.id);
  if ((count ?? 0) >= features.seats) return { error: `${features.name} includes ${features.seats} seats.` };
  const token = crypto.randomUUID().replaceAll("-", "");
  const { error } = await session.supabase.from("invitations").insert({
    firm_id: session.firm.id,
    email,
    role,
    token,
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: token };
}

export async function renameStage(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const { error } = await session.supabase
    .from("pipeline_stages")
    .update({ name: text(formData, "name"), probability: Number(text(formData, "probability") || "0") })
    .eq("id", text(formData, "id"));
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/deals");
}

export async function createField(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  if (!featuresFor(session.firm).customFields) return { error: "Custom fields are on the Growth and Pro plans." };
  const label = text(formData, "label");
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!key) return { error: "Give the field a label." };
  const options = text(formData, "options")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const { error } = await session.supabase.from("custom_field_defs").insert({
    firm_id: session.firm.id,
    module: text(formData, "module"),
    key,
    label,
    field_type: text(formData, "field_type"),
    options,
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
}

export async function createWorkflow(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  if (!featuresFor(session.firm).workflows) return { error: "Workflows are on the Growth and Pro plans." };
  const event = text(formData, "trigger_event");
  const actions =
    event === "lead.created"
      ? [
          { type: "assign_owner", userId: text(formData, "user_id") || session.profile.id },
          { type: "create_task", subject: text(formData, "task_subject") || "Follow up", dueInDays: Number(text(formData, "due_in_days") || "1"), ownerId: text(formData, "user_id") || session.profile.id },
        ]
      : [{ type: "notify", userId: text(formData, "user_id") || session.profile.id, title: text(formData, "title") || "Deal stage changed", body: text(formData, "body") || "{{deal_name}} moved to {{stage_name}}" }];
  const { error } = await session.supabase.from("workflow_rules").insert({
    firm_id: session.firm.id,
    name: text(formData, "name") || "Workflow",
    trigger_event: event,
    actions,
    active: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
}

export async function toggleWorkflow(formData: FormData) {
  const session = await requireWriter();
  if (session.error) throw new Error(session.error);
  const { error } = await session.supabase
    .from("workflow_rules")
    .update({ active: formData.get("active") === "on" })
    .eq("id", text(formData, "id"));
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function createTemplate(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  const { error } = await session.supabase.from("message_templates").insert({
    firm_id: session.firm.id,
    channel: text(formData, "channel"),
    name: text(formData, "name"),
    subject: text(formData, "subject") || null,
    body: text(formData, "body"),
  });
  if (error) return { error: error.message };
  revalidatePath("/settings");
}

export async function overrideDueDay(formData: FormData) {
  const session = await requireOwner();
  if (session.error) return { error: session.error };
  const [code, variant] = text(formData, "rule").split("|");
  const dueDay = Number(text(formData, "due_day"));
  if (!code || !variant || dueDay < 1 || dueDay > 31) return { error: "Pick a rule and a day from 1 to 31." };
  const { data: system } = await session.supabase
    .from("compliance_rules")
    .select("*")
    .is("firm_id", null)
    .eq("code", code)
    .eq("variant", variant)
    .maybeSingle();
  if (!system) return { error: "System rule not found." };
  const { data: existing } = await session.supabase
    .from("compliance_rules")
    .select("id")
    .eq("firm_id", session.firm.id)
    .eq("code", code)
    .eq("variant", variant)
    .maybeSingle();
  let ruleId = existing?.id as string | undefined;
  if (!ruleId) {
    const { data: created, error } = await session.supabase
      .from("compliance_rules")
      .insert({
        firm_id: session.firm.id,
        code: system.code,
        variant: system.variant,
        name: system.name,
        frequency: system.frequency,
        entity_types: system.entity_types,
        gst_frequencies: system.gst_frequencies,
        requires_gstin: system.requires_gstin,
        audit_mode: system.audit_mode,
        state_codes: system.state_codes,
        notes: `Firm override. Due day set to ${dueDay}.`,
      })
      .select("id")
      .single();
    if (error || !created) return { error: error?.message ?? "Could not save the override." };
    ruleId = created.id;
    const { data: periods } = await session.supabase.from("compliance_rule_periods").select("*").eq("rule_id", system.id);
    const { error: periodError } = await session.supabase.from("compliance_rule_periods").insert(
      (periods ?? []).map((period) => ({
        rule_id: ruleId,
        period_key: period.period_key,
        label: period.label,
        start_month: period.start_month,
        start_year_offset: period.start_year_offset,
        end_month: period.end_month,
        end_year_offset: period.end_year_offset,
        due_month: period.due_month,
        due_day: dueDay,
        due_year_offset: period.due_year_offset,
        sort: period.sort,
      })),
    );
    if (periodError) return { error: periodError.message };
  } else {
    const { error } = await session.supabase.from("compliance_rule_periods").update({ due_day: dueDay }).eq("rule_id", ruleId);
    if (error) return { error: error.message };
  }
  revalidatePath("/settings");
  revalidatePath("/compliance");
  return { ok: "Saved. Generate the year again to add any missing periods. Filed rows stay as they are." };
}

async function razorpayPlan(plan: PlanId) {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const planId = process.env[`RAZORPAY_PLAN_${plan.toUpperCase()}`];
  if (!key || !secret || !planId) return { configured: false as const };
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ plan_id: planId, total_count: 12, customer_notify: 1 }),
  });
  const json = (await response.json()) as { id?: string; short_url?: string; error?: { description?: string } };
  if (!response.ok || !json.short_url) {
    return { configured: true as const, error: json.error?.description ?? "Razorpay did not open a subscription." };
  }
  return { configured: true as const, url: json.short_url, id: json.id ?? "" };
}

export async function startSubscription(formData: FormData) {
  const session = await requireOwner();
  if (session.error) return { error: session.error };
  const plan = text(formData, "plan");
  if (!isPlanId(plan)) return { error: "Unknown plan." };
  if (PLANS[plan].priceInr === 0) {
    const { error } = await session.supabase
      .from("firms")
      .update({ plan, subscription_status: "active", trial_ends_at: null, razorpay_subscription_id: null })
      .eq("id", session.firm.id);
    if (error) return { error: error.message };
    revalidatePath("/settings");
    return { ok: `${PLANS[plan].name} (Free) is now active.` };
  }
  const result = await razorpayPlan(plan);
  if (!result.configured) return { error: "Razorpay test keys are not set. Use local activation, or add the keys from the Razorpay test dashboard." };
  if ("error" in result && result.error) return { error: result.error };
  if ("id" in result && result.id) {
    await session.supabase.from("firms").update({ razorpay_subscription_id: result.id, plan }).eq("id", session.firm.id);
  }
  return { url: "url" in result ? result.url : undefined };
}

export async function activateLocalPlan(formData: FormData) {
  const session = await requireOwner();
  if (session.error) return { error: session.error };
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    return { error: "Razorpay keys are set. Use the Razorpay test checkout." };
  }
  const plan = text(formData, "plan");
  if (!isPlanId(plan)) return { error: "Unknown plan." };
  const { error } = await session.supabase
    .from("firms")
    .update({ plan, subscription_status: "active", trial_ends_at: null })
    .eq("id", session.firm.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: `${plan} is active in this local workspace. No payment was taken.` };
}

export async function applyRazorpayEvent(payload: { event?: string; payload?: { subscription?: { entity?: { id?: string; status?: string; notes?: { firm_id?: string } } } } }) {
  const subscription = payload.payload?.subscription?.entity;
  if (!subscription?.id) return;
  const admin = createAdmin();
  let firmId = subscription.notes?.firm_id;
  if (!firmId) {
    const { data } = await admin.from("firms").select("id").eq("razorpay_subscription_id", subscription.id).maybeSingle();
    firmId = data?.id;
  }
  if (!firmId) return;
  const status = subscription.status;
  const mapped = status === "active" ? "active" : status === "halted" || status === "pending" ? "past_due" : status === "cancelled" ? "cancelled" : null;
  if (!mapped) return;
  await admin.from("firms").update({ subscription_status: mapped, razorpay_subscription_id: subscription.id }).eq("id", firmId);
}

export async function updateAiSettings(formData: FormData) {
  const session = await requireWriter();
  if (session.error) return { error: session.error };
  if (!canManageAiSettings(session.profile.role)) {
    return { error: "Only the firm owner or a partner can manage AI Copilot settings." };
  }

  const enabled = formData.get("enabled") === "on";
  const noticeAccepted = formData.get("notice_accepted") === "on";
  if (enabled && !noticeAccepted) {
    return { error: "Accept the external AI provider notice before enabling AI Copilot." };
  }

  const nowIso = new Date().toISOString();
  const { error } = await session.supabase.from("ai_firm_settings").upsert(
    {
      firm_id: session.firm.id,
      enabled,
      notice_accepted_at: enabled ? nowIso : null,
      notice_accepted_by: enabled ? session.profile.id : null,
      updated_at: nowIso,
    },
    { onConflict: "firm_id" },
  );

  if (error) {
    if (isMissingTableError(error)) {
      return { error: "Apply the AI Copilot database migration before saving this setting." };
    }
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/activities");
  revalidatePath("/clients");
  revalidatePath("/leads");
  return {
    ok: enabled
      ? "AI Copilot is enabled for this firm."
      : "AI Copilot is disabled for this firm.",
  };
}

