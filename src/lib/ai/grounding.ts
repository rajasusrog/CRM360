import type {
  BriefingModelOutputSchema,
  FollowUpModelOutputSchema,
  NotesToTasksModelOutputSchema,
  SourceRecordRef,
} from "@/lib/ai/schemas";
import type { z } from "zod";

export function sanitizeUntrustedText(input: string | null | undefined, maxLen = 1500): string {
  if (!input) return "";
  const cleaned = input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/<\/?untrusted_crm_data>/gi, "")
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen)}…`;
}

export function wrapUntrustedBlock(label: string, payload: unknown): string {
  const serialized = typeof payload === "string" ? sanitizeUntrustedText(payload, 12_000) : JSON.stringify(payload);
  return `<untrusted_crm_data label="${sanitizeUntrustedText(label, 60)}">\n${serialized.replace(/<\/?untrusted_crm_data>/gi, "")}\n</untrusted_crm_data>`;
}

export function filterValidCitations(
  keys: ReadonlyArray<string>,
  allowedSources: ReadonlyMap<string, SourceRecordRef>,
): SourceRecordRef[] {
  const seen = new Set<string>();
  const resolved: SourceRecordRef[] = [];
  for (const key of keys) {
    const trimmed = key.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    const match = allowedSources.get(trimmed);
    if (!match) continue;
    seen.add(trimmed);
    resolved.push(match);
  }
  return resolved;
}

export function buildSourceMap(refs: ReadonlyArray<SourceRecordRef>): Map<string, SourceRecordRef> {
  const map = new Map<string, SourceRecordRef>();
  for (const ref of refs) {
    map.set(ref.key, ref);
  }
  return map;
}

export type GroundedFact = {
  text: string;
  sources: SourceRecordRef[];
};

export type GroundedBriefing = {
  overview: {
    summary: string;
    facts: GroundedFact[];
  } | null;
  recentActivity: GroundedFact[];
  openDeals: GroundedFact[];
  outstandingCommitments: GroundedFact[];
  suggestedNextActions: Array<{ action: string; rationale: string }>;
  missingInformation: string[];
};

export function groundBriefingOutput(
  raw: z.infer<typeof BriefingModelOutputSchema>,
  allowedSources: ReadonlyMap<string, SourceRecordRef>,
): GroundedBriefing {
  const mapFacts = (items: ReadonlyArray<{ text: string; citations: string[] }>): GroundedFact[] =>
    items
      .map((item) => ({
        text: item.text.trim(),
        sources: filterValidCitations(item.citations, allowedSources),
      }))
      .filter((item) => item.text.length > 0);

  const overviewFacts = mapFacts(raw.overviewFacts);
  const overviewSummary = raw.overviewSummary.trim();

  return {
    overview:
      overviewSummary || overviewFacts.length > 0
        ? {
            summary: overviewSummary,
            facts: overviewFacts,
          }
        : null,
    recentActivity: mapFacts(raw.recentActivity),
    openDeals: mapFacts(raw.openDeals),
    outstandingCommitments: mapFacts(raw.outstandingCommitments),
    suggestedNextActions: raw.suggestedNextActions
      .map((item) => ({ action: item.action.trim(), rationale: item.rationale.trim() }))
      .filter((item) => item.action.length > 0),
    missingInformation: raw.missingInformation.map((item) => item.trim()).filter(Boolean),
  };
}

export type GroundedFollowUp = {
  subject: string | null;
  draft: string;
  sources: SourceRecordRef[];
  missingDetails: string[];
};

export function groundFollowUpOutput(
  raw: z.infer<typeof FollowUpModelOutputSchema>,
  allowedSources: ReadonlyMap<string, SourceRecordRef>,
): GroundedFollowUp {
  return {
    subject: raw.subject?.trim() ? raw.subject.trim() : null,
    draft: raw.draft.trim(),
    sources: filterValidCitations(raw.citations, allowedSources),
    missingDetails: raw.missingDetails.map((item) => item.trim()).filter(Boolean),
  };
}

export type StaffMember = {
  id: string;
  full_name: string;
  role: string;
};

export type GroundedProposedTask = {
  title: string;
  description: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  supportingExcerpt: string;
  unresolvedQuestions: string[];
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoCalendarDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function groundProposedTasksOutput(
  raw: z.infer<typeof NotesToTasksModelOutputSchema>,
  permittedStaff: ReadonlyArray<StaffMember>,
): GroundedProposedTask[] {
  const staffById = new Map(permittedStaff.map((person) => [person.id, person]));

  return raw.tasks
    .map((task) => {
      const matchedStaff = task.assigneeId ? staffById.get(task.assigneeId.trim()) ?? null : null;
      const validDueDate = isValidIsoCalendarDate(task.dueDate?.trim() ?? null) ? task.dueDate!.trim() : null;
      const unresolved = [...task.unresolvedQuestions.map((q) => q.trim()).filter(Boolean)];

      if (task.assigneeId && !matchedStaff && !unresolved.some((q) => /assign|owner|staff/i.test(q))) {
        unresolved.push("Assignee could not be matched confidently to a firm staff member.");
      }
      if (task.dueDate && !validDueDate && !unresolved.some((q) => /date|due|when/i.test(q))) {
        unresolved.push("Due date was ambiguous and needs manual confirmation.");
      }

      return {
        title: task.title.trim(),
        description: task.description.trim(),
        assigneeId: matchedStaff ? matchedStaff.id : null,
        assigneeName: matchedStaff ? matchedStaff.full_name : null,
        dueDate: validDueDate,
        supportingExcerpt: sanitizeUntrustedText(task.supportingExcerpt, 400),
        unresolvedQuestions: unresolved,
      };
    })
    .filter((task) => task.title.length > 0);
}
