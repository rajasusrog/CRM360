import {
  buildSourceMap,
  groundBriefingOutput,
  groundFollowUpOutput,
  groundProposedTasksOutput,
  sanitizeUntrustedText,
  type GroundedBriefing,
  type GroundedFollowUp,
  type GroundedProposedTask,
  type StaffMember,
} from "@/lib/ai/grounding";
import { isMissingTableError, runAiFeature, type GenerateJsonFn } from "@/lib/ai/gateway";
import {
  BRIEFING_RESPONSE_SCHEMA,
  BRIEFING_SYSTEM_INSTRUCTION,
  FOLLOW_UP_RESPONSE_SCHEMA,
  FOLLOW_UP_SYSTEM_INSTRUCTION,
  NOTES_TO_TASKS_RESPONSE_SCHEMA,
  NOTES_TO_TASKS_SYSTEM_INSTRUCTION,
  buildBriefingPrompt,
  buildFollowUpPrompt,
  buildNotesToTasksPrompt,
} from "@/lib/ai/prompts";
import {
  BriefingModelOutputSchema,
  ConfirmTasksRequestSchema,
  FeedbackRequestSchema,
  FollowUpModelOutputSchema,
  FollowUpRequestSchema,
  NotesToTasksModelOutputSchema,
  NotesToTasksRequestSchema,
  type SourceRecordRef,
} from "@/lib/ai/schemas";
import type { CrmSupabaseClient, Firm, Profile } from "@/lib/auth-routing";
import { todayIsoInIst } from "@/lib/format";
import type { z } from "zod";

export type AiServiceContext = {
  supabase: CrmSupabaseClient;
  firm: Firm;
  profile: Profile;
  signal?: AbortSignal;
  generateJson?: GenerateJsonFn;
  now?: Date;
};

type ServiceOutcome<T> =
  | { ok: true; status: 200; body: T }
  | { ok: false; status: number; error: string; requestId?: string };

export async function generateCustomerBriefing(
  ctx: AiServiceContext,
  accountId: string,
): Promise<
  ServiceOutcome<{
    requestId: string;
    model: string;
    accountId: string;
    accountName: string;
    briefing: GroundedBriefing;
  }>
> {
  const { data: account } = await ctx.supabase
    .from("accounts")
    .select(
      "id, firm_id, name, entity_type, gst_filing_frequency, state_code, requires_audit, email, phone, city, assigned_staff_id, status, portal_enabled, consent_data_processing, notes, created_at",
    )
    .eq("id", accountId)
    .eq("firm_id", ctx.firm.id)
    .maybeSingle();

  if (!account) {
    return { ok: false, status: 404, error: "Client account not found." };
  }

  const [contactsRes, dealsRes, filingsRes, engagementsRes, invoicesRes, docsRes, requestsRes, staffRes, accountActivitiesRes] =
    await Promise.all([
      ctx.supabase
        .from("contacts")
        .select("id, first_name, last_name, designation, is_primary, email, phone")
        .eq("firm_id", ctx.firm.id)
        .eq("account_id", accountId)
        .is("deleted_at", null)
        .limit(12),
      ctx.supabase
        .from("deals")
        .select("id, name, amount, expected_close, source, notes, pipeline_stages(name, is_won, is_lost)")
        .eq("firm_id", ctx.firm.id)
        .eq("account_id", accountId)
        .limit(12),
      ctx.supabase
        .from("compliance_filings")
        .select("id, rule_code, name, period_label, due_date, status")
        .eq("firm_id", ctx.firm.id)
        .eq("account_id", accountId)
        .order("due_date", { ascending: true })
        .limit(18),
      ctx.supabase
        .from("engagements")
        .select("id, service_name, fee, billing_cycle, start_date, status, notes")
        .eq("firm_id", ctx.firm.id)
        .eq("account_id", accountId)
        .limit(12),
      ctx.supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, due_date, description, total, status")
        .eq("firm_id", ctx.firm.id)
        .eq("account_id", accountId)
        .neq("status", "void")
        .order("invoice_date", { ascending: false })
        .limit(12),
      ctx.supabase
        .from("documents")
        .select("id, name, folder, financial_year, client_visible, created_at")
        .eq("firm_id", ctx.firm.id)
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(12),
      ctx.supabase
        .from("document_requests")
        .select("id, title, financial_year, folder, status, notes, created_at")
        .eq("firm_id", ctx.firm.id)
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(10),
      ctx.supabase.from("profiles").select("id, full_name, role").eq("firm_id", ctx.firm.id),
      ctx.supabase
        .from("activities")
        .select("id, type, subject, body, due_at, completed_at, related_type, related_id, created_at")
        .eq("firm_id", ctx.firm.id)
        .eq("related_type", "account")
        .eq("related_id", accountId)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

  const contacts = contactsRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const filings = filingsRes.data ?? [];
  const engagements = engagementsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const docs = docsRes.data ?? [];
  const requests = requestsRes.data ?? [];
  const staffMap = new Map((staffRes.data ?? []).map((p: StaffMember) => [p.id, p.full_name]));

  const relatedExtraIds = [
    ...deals.map((d: { id: string }) => d.id),
    ...invoices.map((i: { id: string }) => i.id),
    ...filings.map((f: { id: string }) => f.id),
    ...contacts.map((c: { id: string }) => c.id),
  ];

  let relatedActivities: Array<Record<string, unknown>> = accountActivitiesRes.data ?? [];
  if (relatedExtraIds.length > 0) {
    const { data: extraActs } = await ctx.supabase
      .from("activities")
      .select("id, type, subject, body, due_at, completed_at, related_type, related_id, created_at")
      .eq("firm_id", ctx.firm.id)
      .in("related_id", relatedExtraIds)
      .order("created_at", { ascending: false })
      .limit(15);
    const seen = new Set(relatedActivities.map((a) => String(a.id)));
    for (const act of extraActs ?? []) {
      if (!seen.has(String(act.id))) {
        seen.add(String(act.id));
        relatedActivities.push(act);
      }
    }
    relatedActivities = relatedActivities.slice(0, 20);
  }

  const sources: SourceRecordRef[] = [
    {
      key: `account:${account.id}`,
      recordType: "account",
      recordId: account.id,
      label: account.name,
      href: `/clients/${account.id}`,
    },
  ];

  const contactDtos = contacts.map((contact: Record<string, unknown>) => {
    const key = `contact:${contact.id}`;
    const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
    sources.push({
      key,
      recordType: "contact",
      recordId: String(contact.id),
      label: fullName || "Contact",
      href: `/contacts/${contact.id}`,
    });
    return {
      sourceKey: key,
      name: sanitizeUntrustedText(fullName, 120),
      designation: sanitizeUntrustedText(contact.designation as string | null, 80),
      isPrimary: Boolean(contact.is_primary),
      hasEmail: Boolean(contact.email),
      hasPhone: Boolean(contact.phone),
    };
  });

  const dealDtos = deals.map((deal: Record<string, unknown>) => {
    const key = `deal:${deal.id}`;
    const stageRaw = Array.isArray(deal.pipeline_stages) ? deal.pipeline_stages[0] : deal.pipeline_stages;
    const stage = (stageRaw as { name?: string; is_won?: boolean; is_lost?: boolean } | null) ?? null;
    sources.push({
      key,
      recordType: "deal",
      recordId: String(deal.id),
      label: sanitizeUntrustedText(String(deal.name ?? "Deal"), 80),
      href: "/deals",
    });
    return {
      sourceKey: key,
      name: sanitizeUntrustedText(String(deal.name ?? ""), 140),
      stage: stage?.name ?? "Unknown",
      isOpen: !stage?.is_won && !stage?.is_lost,
      amountInr: Number(deal.amount ?? 0),
      expectedClose: deal.expected_close ?? null,
      notes: sanitizeUntrustedText(deal.notes as string | null, 300),
    };
  });

  const activityDtos = relatedActivities.map((act) => {
    const key = `activity:${act.id}`;
    sources.push({
      key,
      recordType: "activity",
      recordId: String(act.id),
      label: `${String(act.type ?? "activity")}: ${sanitizeUntrustedText(String(act.subject ?? ""), 60)}`,
      href: "/activities",
    });
    return {
      sourceKey: key,
      type: act.type,
      subject: sanitizeUntrustedText(String(act.subject ?? ""), 160),
      body: sanitizeUntrustedText(act.body as string | null, 300),
      dueAt: act.due_at ?? null,
      completedAt: act.completed_at ?? null,
      createdAt: act.created_at ?? null,
    };
  });

  const filingDtos = filings.map((filing: Record<string, unknown>) => {
    const key = `filing:${filing.id}`;
    sources.push({
      key,
      recordType: "filing",
      recordId: String(filing.id),
      label: `${String(filing.name ?? "Filing")} (${String(filing.period_label ?? "")})`,
      href: "/compliance",
    });
    return {
      sourceKey: key,
      name: filing.name,
      periodLabel: filing.period_label,
      dueDate: filing.due_date,
      status: filing.status,
    };
  });

  const engagementDtos = engagements.map((eng: Record<string, unknown>) => {
    const key = `engagement:${eng.id}`;
    sources.push({
      key,
      recordType: "engagement",
      recordId: String(eng.id),
      label: sanitizeUntrustedText(String(eng.service_name ?? "Engagement"), 80),
      href: `/clients/${account.id}`,
    });
    return {
      sourceKey: key,
      serviceName: sanitizeUntrustedText(String(eng.service_name ?? ""), 120),
      feeInr: Number(eng.fee ?? 0),
      billingCycle: eng.billing_cycle,
      status: eng.status,
      notes: sanitizeUntrustedText(eng.notes as string | null, 200),
    };
  });

  const invoiceDtos = invoices.map((inv: Record<string, unknown>) => {
    const key = `invoice:${inv.id}`;
    sources.push({
      key,
      recordType: "invoice",
      recordId: String(inv.id),
      label: `Invoice ${String(inv.invoice_number ?? "")}`,
      href: `/invoices/${inv.id}`,
    });
    return {
      sourceKey: key,
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date ?? null,
      description: sanitizeUntrustedText(String(inv.description ?? ""), 160),
      totalInr: Number(inv.total ?? 0),
      status: inv.status,
    };
  });

  const documentDtos = docs.map((doc: Record<string, unknown>) => {
    const key = `document:${doc.id}`;
    sources.push({
      key,
      recordType: "document",
      recordId: String(doc.id),
      label: sanitizeUntrustedText(String(doc.name ?? "Document"), 80),
      href: `/api/documents/${doc.id}`,
    });
    return {
      sourceKey: key,
      name: sanitizeUntrustedText(String(doc.name ?? ""), 120),
      folder: doc.folder,
      financialYear: doc.financial_year,
      clientVisible: Boolean(doc.client_visible),
    };
  });

  const requestDtos = requests.map((req: Record<string, unknown>) => {
    const key = `document_request:${req.id}`;
    sources.push({
      key,
      recordType: "document_request",
      recordId: String(req.id),
      label: sanitizeUntrustedText(String(req.title ?? "Document request"), 80),
      href: `/clients/${account.id}`,
    });
    return {
      sourceKey: key,
      title: sanitizeUntrustedText(String(req.title ?? ""), 120),
      financialYear: req.financial_year,
      status: req.status,
      notes: sanitizeUntrustedText(req.notes as string | null, 200),
    };
  });

  const prompt = buildBriefingPrompt({
    todayIst: todayIsoInIst(ctx.now),
    firmName: ctx.firm.name,
    client: {
      sourceKey: `account:${account.id}`,
      name: sanitizeUntrustedText(account.name, 140),
      entityType: account.entity_type,
      city: sanitizeUntrustedText(account.city, 80),
      stateCode: account.state_code,
      gstFilingFrequency: account.gst_filing_frequency,
      requiresAudit: Boolean(account.requires_audit),
      status: account.status,
      portalEnabled: Boolean(account.portal_enabled),
      hasEmail: Boolean(account.email),
      hasPhone: Boolean(account.phone),
      consentRecorded: Boolean(account.consent_data_processing),
      assignedStaff: account.assigned_staff_id ? staffMap.get(account.assigned_staff_id) ?? null : null,
      notes: sanitizeUntrustedText(account.notes, 600),
    },
    contacts: contactDtos,
    deals: dealDtos,
    activities: activityDtos,
    filings: filingDtos,
    engagements: engagementDtos,
    invoices: invoiceDtos,
    documents: documentDtos,
    documentRequests: requestDtos,
  });

  const result = await runAiFeature({
    supabase: ctx.supabase,
    firm: ctx.firm,
    profile: ctx.profile,
    feature: "briefing",
    systemInstruction: BRIEFING_SYSTEM_INSTRUCTION,
    prompt,
    responseSchema: BRIEFING_RESPONSE_SCHEMA,
    zodSchema: BriefingModelOutputSchema,
    requestSignal: ctx.signal,
    generateJson: ctx.generateJson,
    now: ctx.now,
  });

  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error, requestId: result.requestId };
  }

  const allowedSources = buildSourceMap(sources);
  const briefing = groundBriefingOutput(result.data, allowedSources);

  return {
    ok: true,
    status: 200,
    body: {
      requestId: result.requestId,
      model: result.model,
      accountId: account.id,
      accountName: account.name,
      briefing,
    },
  };
}

export async function generateFollowUpDraft(
  ctx: AiServiceContext,
  input: z.infer<typeof FollowUpRequestSchema>,
): Promise<
  ServiceOutcome<{
    requestId: string;
    model: string;
    language: "en" | "ta";
    draft: GroundedFollowUp;
    recipient: { name: string; email: string | null; phone: string | null };
  }>
> {
  const sources: SourceRecordRef[] = [];
  let targetDto: Record<string, unknown>;
  let recipient: { name: string; email: string | null; phone: string | null };
  const selectedRecords: Array<Record<string, unknown>> = [];

  if (input.entityType === "account") {
    const { data: account } = await ctx.supabase
      .from("accounts")
      .select("id, firm_id, name, entity_type, email, phone, city, status, gst_filing_frequency, notes")
      .eq("id", input.entityId)
      .eq("firm_id", ctx.firm.id)
      .maybeSingle();

    if (!account) return { ok: false, status: 404, error: "Client account not found." };

    const accountKey = `account:${account.id}`;
    sources.push({
      key: accountKey,
      recordType: "account",
      recordId: account.id,
      label: account.name,
      href: `/clients/${account.id}`,
    });
    targetDto = {
      sourceKey: accountKey,
      kind: "client_account",
      name: sanitizeUntrustedText(account.name, 140),
      entityType: account.entity_type,
      city: sanitizeUntrustedText(account.city, 80),
      gstFilingFrequency: account.gst_filing_frequency,
      hasEmail: Boolean(account.email),
      hasPhone: Boolean(account.phone),
      notes: sanitizeUntrustedText(account.notes, 400),
    };
    recipient = { name: account.name, email: account.email ?? null, phone: account.phone ?? null };

    const [activitiesRes, filingsRes, invoicesRes] = await Promise.all([
      input.activityIds.length > 0
        ? ctx.supabase
            .from("activities")
            .select("id, type, subject, body, due_at, completed_at")
            .eq("firm_id", ctx.firm.id)
            .eq("related_type", "account")
            .eq("related_id", account.id)
            .in("id", input.activityIds)
        : ctx.supabase
            .from("activities")
            .select("id, type, subject, body, due_at, completed_at")
            .eq("firm_id", ctx.firm.id)
            .eq("related_type", "account")
            .eq("related_id", account.id)
            .order("created_at", { ascending: false })
            .limit(4),
      ctx.supabase
        .from("compliance_filings")
        .select("id, name, period_label, due_date, status")
        .eq("firm_id", ctx.firm.id)
        .eq("account_id", account.id)
        .neq("status", "filed")
        .order("due_date")
        .limit(4),
      ctx.supabase
        .from("invoices")
        .select("id, invoice_number, due_date, total, status")
        .eq("firm_id", ctx.firm.id)
        .eq("account_id", account.id)
        .in("status", ["sent", "partial"])
        .order("invoice_date", { ascending: false })
        .limit(3),
    ]);

    for (const act of activitiesRes.data ?? []) {
      const key = `activity:${act.id}`;
      sources.push({
        key,
        recordType: "activity",
        recordId: act.id,
        label: `${act.type}: ${sanitizeUntrustedText(act.subject, 60)}`,
        href: "/activities",
      });
      selectedRecords.push({
        sourceKey: key,
        recordType: "activity",
        type: act.type,
        subject: sanitizeUntrustedText(act.subject, 160),
        body: sanitizeUntrustedText(act.body, 300),
        dueAt: act.due_at,
        completedAt: act.completed_at,
      });
    }

    for (const filing of filingsRes.data ?? []) {
      const key = `filing:${filing.id}`;
      sources.push({
        key,
        recordType: "filing",
        recordId: filing.id,
        label: `${filing.name} (${filing.period_label})`,
        href: "/compliance",
      });
      selectedRecords.push({
        sourceKey: key,
        recordType: "filing",
        name: filing.name,
        periodLabel: filing.period_label,
        dueDate: filing.due_date,
        status: filing.status,
      });
    }

    for (const inv of invoicesRes.data ?? []) {
      const key = `invoice:${inv.id}`;
      sources.push({
        key,
        recordType: "invoice",
        recordId: inv.id,
        label: `Invoice ${inv.invoice_number}`,
        href: `/invoices/${inv.id}`,
      });
      selectedRecords.push({
        sourceKey: key,
        recordType: "invoice",
        invoiceNumber: inv.invoice_number,
        dueDate: inv.due_date,
        totalInr: Number(inv.total ?? 0),
        status: inv.status,
      });
    }
  } else {
    const { data: lead } = await ctx.supabase
      .from("leads")
      .select("id, firm_id, first_name, last_name, company, email, phone, source, status, city, notes")
      .eq("id", input.entityId)
      .eq("firm_id", ctx.firm.id)
      .maybeSingle();

    if (!lead) return { ok: false, status: 404, error: "Lead not found." };

    const leadName = `${lead.first_name} ${lead.last_name ?? ""}`.trim();
    const leadKey = `lead:${lead.id}`;
    sources.push({
      key: leadKey,
      recordType: "lead",
      recordId: lead.id,
      label: lead.company ? `${leadName} (${lead.company})` : leadName,
      href: `/leads/${lead.id}`,
    });
    targetDto = {
      sourceKey: leadKey,
      kind: "lead",
      name: sanitizeUntrustedText(leadName, 120),
      company: sanitizeUntrustedText(lead.company, 120),
      source: lead.source,
      status: lead.status,
      city: sanitizeUntrustedText(lead.city, 80),
      hasEmail: Boolean(lead.email),
      hasPhone: Boolean(lead.phone),
      notes: sanitizeUntrustedText(lead.notes, 400),
    };
    recipient = { name: leadName, email: lead.email ?? null, phone: lead.phone ?? null };

    const activitiesRes =
      input.activityIds.length > 0
        ? await ctx.supabase
            .from("activities")
            .select("id, type, subject, body, due_at, completed_at")
            .eq("firm_id", ctx.firm.id)
            .eq("related_type", "lead")
            .eq("related_id", lead.id)
            .in("id", input.activityIds)
        : await ctx.supabase
            .from("activities")
            .select("id, type, subject, body, due_at, completed_at")
            .eq("firm_id", ctx.firm.id)
            .eq("related_type", "lead")
            .eq("related_id", lead.id)
            .order("created_at", { ascending: false })
            .limit(4);

    for (const act of activitiesRes.data ?? []) {
      const key = `activity:${act.id}`;
      sources.push({
        key,
        recordType: "activity",
        recordId: act.id,
        label: `${act.type}: ${sanitizeUntrustedText(act.subject, 60)}`,
        href: "/activities",
      });
      selectedRecords.push({
        sourceKey: key,
        recordType: "activity",
        type: act.type,
        subject: sanitizeUntrustedText(act.subject, 160),
        body: sanitizeUntrustedText(act.body, 300),
        dueAt: act.due_at,
      });
    }
  }

  const prompt = buildFollowUpPrompt({
    todayIst: todayIsoInIst(ctx.now),
    firmName: ctx.firm.name,
    senderName: ctx.profile.full_name,
    tone: input.tone,
    language: input.language,
    purpose: input.purpose,
    target: targetDto,
    selectedRecords,
  });

  const result = await runAiFeature({
    supabase: ctx.supabase,
    firm: ctx.firm,
    profile: ctx.profile,
    feature: "follow_up",
    systemInstruction: FOLLOW_UP_SYSTEM_INSTRUCTION,
    prompt,
    responseSchema: FOLLOW_UP_RESPONSE_SCHEMA,
    zodSchema: FollowUpModelOutputSchema,
    requestSignal: ctx.signal,
    generateJson: ctx.generateJson,
    now: ctx.now,
  });

  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error, requestId: result.requestId };
  }

  const allowedSources = buildSourceMap(sources);
  const draft = groundFollowUpOutput(result.data, allowedSources);

  return {
    ok: true,
    status: 200,
    body: {
      requestId: result.requestId,
      model: result.model,
      language: input.language,
      draft,
      recipient,
    },
  };
}

export async function extractTasksFromNotes(
  ctx: AiServiceContext,
  input: z.infer<typeof NotesToTasksRequestSchema>,
): Promise<
  ServiceOutcome<{
    requestId: string;
    model: string;
    todayIst: string;
    staff: StaffMember[];
    tasks: GroundedProposedTask[];
  }>
> {
  let relatedContext: Record<string, unknown> | null = null;
  if (input.relatedType && input.relatedId) {
    if (input.relatedType === "account") {
      const { data: account } = await ctx.supabase
        .from("accounts")
        .select("id, name, entity_type")
        .eq("firm_id", ctx.firm.id)
        .eq("id", input.relatedId)
        .maybeSingle();
      if (!account) return { ok: false, status: 404, error: "Client account not found." };
      relatedContext = {
        type: "account",
        name: sanitizeUntrustedText(account.name, 140),
        entityType: account.entity_type,
      };
    } else {
      const { data: lead } = await ctx.supabase
        .from("leads")
        .select("id, first_name, last_name, company")
        .eq("firm_id", ctx.firm.id)
        .eq("id", input.relatedId)
        .maybeSingle();
      if (!lead) return { ok: false, status: 404, error: "Lead not found." };
      relatedContext = {
        type: "lead",
        name: sanitizeUntrustedText(`${lead.first_name} ${lead.last_name ?? ""}`.trim(), 120),
        company: sanitizeUntrustedText(lead.company, 120),
      };
    }
  }

  const { data: staffRows } = await ctx.supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("firm_id", ctx.firm.id)
    .in("role", ["owner", "partner", "staff"])
    .order("full_name");

  const permittedStaff: StaffMember[] = staffRows ?? [];
  const now = ctx.now ?? new Date();
  const todayIst = todayIsoInIst(now);
  const weekdayIst = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
  }).format(now);

  const prompt = buildNotesToTasksPrompt({
    todayIst,
    weekdayIst,
    permittedStaff,
    relatedContext,
    notes: input.notes,
  });

  const result = await runAiFeature({
    supabase: ctx.supabase,
    firm: ctx.firm,
    profile: ctx.profile,
    feature: "notes_to_tasks",
    systemInstruction: NOTES_TO_TASKS_SYSTEM_INSTRUCTION,
    prompt,
    responseSchema: NOTES_TO_TASKS_RESPONSE_SCHEMA,
    zodSchema: NotesToTasksModelOutputSchema,
    requestSignal: ctx.signal,
    generateJson: ctx.generateJson,
    now,
  });

  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error, requestId: result.requestId };
  }

  const tasks = groundProposedTasksOutput(result.data, permittedStaff);
  return {
    ok: true,
    status: 200,
    body: {
      requestId: result.requestId,
      model: result.model,
      todayIst,
      staff: permittedStaff,
      tasks,
    },
  };
}

export async function confirmProposedTasks(
  ctx: Pick<AiServiceContext, "supabase" | "firm" | "profile">,
  input: z.infer<typeof ConfirmTasksRequestSchema>,
): Promise<ServiceOutcome<{ ok: true; deduplicated: boolean; createdIds: string[] }>> {
  const existingBatch = await ctx.supabase
    .from("ai_task_batches")
    .select("id, created_activity_ids")
    .eq("firm_id", ctx.firm.id)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  if (existingBatch.error && isMissingTableError(existingBatch.error)) {
    return {
      ok: false,
      status: 503,
      error: "AI Copilot database tables are not provisioned yet. Apply the latest Supabase migration.",
    };
  }

  if (existingBatch.data) {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        deduplicated: true,
        createdIds: Array.isArray(existingBatch.data.created_activity_ids)
          ? existingBatch.data.created_activity_ids.map(String)
          : [],
      },
    };
  }

  const relatedType = input.relatedType ?? null;
  const relatedId = input.relatedId ?? null;
  if (relatedType && relatedId) {
    const table = relatedType === "account" ? "accounts" : "leads";
    const { data: target } = await ctx.supabase
      .from(table)
      .select("id")
      .eq("firm_id", ctx.firm.id)
      .eq("id", relatedId)
      .maybeSingle();
    if (!target) {
      return { ok: false, status: 404, error: "Related client or lead was not found in this firm." };
    }
  }

  const { data: staffRows } = await ctx.supabase
    .from("profiles")
    .select("id")
    .eq("firm_id", ctx.firm.id)
    .in("role", ["owner", "partner", "staff"]);
  const allowedStaffIds = new Set((staffRows ?? []).map((row: { id: string }) => row.id));

  const rowsToInsert = input.tasks.map((task) => {
    const ownerId = task.assigneeId && allowedStaffIds.has(task.assigneeId) ? task.assigneeId : ctx.profile.id;
    const dueAt = task.dueDate ? new Date(`${task.dueDate}T18:00:00+05:30`).toISOString() : null;
    return {
      firm_id: ctx.firm.id,
      type: "task",
      subject: task.title.trim(),
      body: task.description?.trim() || null,
      due_at: dueAt,
      related_type: relatedType,
      related_id: relatedId,
      owner_id: ownerId,
    };
  });

  const { data: insertedActivities, error: insertError } = await ctx.supabase
    .from("activities")
    .insert(rowsToInsert)
    .select("id");

  if (insertError || !insertedActivities) {
    return { ok: false, status: 500, error: insertError?.message ?? "Could not create tasks." };
  }

  const createdIds = insertedActivities.map((row: { id: string }) => row.id);

  const { error: batchError } = await ctx.supabase.from("ai_task_batches").insert({
    firm_id: ctx.firm.id,
    user_id: ctx.profile.id,
    idempotency_key: input.idempotencyKey,
    related_type: relatedType,
    related_id: relatedId,
    created_activity_ids: createdIds,
  });

  if (batchError && batchError.code === "23505") {
    const { data: raceBatch } = await ctx.supabase
      .from("ai_task_batches")
      .select("created_activity_ids")
      .eq("firm_id", ctx.firm.id)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        deduplicated: true,
        createdIds: Array.isArray(raceBatch?.created_activity_ids)
          ? raceBatch.created_activity_ids.map(String)
          : createdIds,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      deduplicated: false,
      createdIds,
    },
  };
}

export async function recordAiFeedback(
  ctx: Pick<AiServiceContext, "supabase" | "firm" | "profile">,
  input: z.infer<typeof FeedbackRequestSchema>,
): Promise<ServiceOutcome<{ ok: true }>> {
  const { error } = await ctx.supabase.from("ai_feedback").insert({
    firm_id: ctx.firm.id,
    user_id: ctx.profile.id,
    feature: input.feature,
    request_id: input.requestId,
    helpful: input.helpful,
    comment: input.comment?.trim() || null,
  });

  if (error) {
    if (isMissingTableError(error)) {
      return { ok: false, status: 503, error: "Feedback storage is not provisioned yet." };
    }
    return { ok: false, status: 500, error: error.message };
  }

  return { ok: true, status: 200, body: { ok: true } };
}
