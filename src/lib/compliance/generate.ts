import type { ComplianceClient, ComplianceRule, FilingDraft, StoredRule, YearOffset } from "./types";

export function fillLabel(template: string, fyStartYear: number): string {
  const end = fyStartYear + 1;
  return template
    .replaceAll("{{y0}}", String(fyStartYear))
    .replaceAll("{{y1}}", String(end))
    .replaceAll("{{fy}}", `${fyStartYear}-${String(end).slice(2)}`);
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date ${year}-${month}-${day}.`);
  }
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function yearFor(fyStartYear: number, offset: YearOffset): number {
  return fyStartYear + offset;
}

export function ruleMatches(rule: ComplianceRule, client: ComplianceClient): boolean {
  if (rule.entityTypes && !rule.entityTypes.includes(client.entityType)) return false;
  if (rule.requiresGstin && !client.gstin) return false;
  if (rule.gstFrequencies) {
    if (!client.gstFilingFrequency || !rule.gstFrequencies.includes(client.gstFilingFrequency)) return false;
  }
  if (rule.auditMode === "audit" && !client.requiresAudit) return false;
  if (rule.auditMode === "non_audit" && client.requiresAudit) return false;
  if (rule.stateCodes && !rule.stateCodes.includes(client.stateCode)) return false;
  return true;
}

/**
 * When several variants share a code, a state-specific rule wins over a nationwide one.
 * GST frequency and audit mode are already filtered by ruleMatches.
 */
export function selectRules(rules: ComplianceRule[], client: ComplianceClient): ComplianceRule[] {
  const groups = new Map<string, ComplianceRule[]>();
  for (const rule of rules) {
    if (!ruleMatches(rule, client)) continue;
    const list = groups.get(rule.code) ?? [];
    list.push(rule);
    groups.set(rule.code, list);
  }
  const chosen: ComplianceRule[] = [];
  for (const group of groups.values()) {
    const specific = group.filter((rule) => rule.stateCodes?.includes(client.stateCode));
    chosen.push(...(specific.length > 0 ? specific : group.filter((rule) => !rule.stateCodes)));
  }
  return chosen;
}

/** Firm rows replace the system row with the same code and variant. */
export function resolveRules(rows: StoredRule[], firmId: string): ComplianceRule[] {
  const firmKeys = new Set(rows.filter((row) => row.firmId === firmId).map((row) => `${row.code}:${row.variant}`));
  return rows.filter((row) => row.firmId === firmId || (row.firmId === null && !firmKeys.has(`${row.code}:${row.variant}`)));
}

export function generateFilings(rules: ComplianceRule[], client: ComplianceClient, fyStartYear: number): FilingDraft[] {
  if (!Number.isInteger(fyStartYear) || fyStartYear < 2000 || fyStartYear > 2100) {
    throw new Error("Financial year must start between 2000 and 2100.");
  }
  const drafts: FilingDraft[] = [];
  for (const rule of selectRules(rules, client)) {
    for (const period of rule.periods) {
      const startYear = yearFor(fyStartYear, period.startYearOffset);
      const endYear = yearFor(fyStartYear, period.endYearOffset);
      const dueYear = yearFor(fyStartYear, period.dueYearOffset);
      drafts.push({
        ruleCode: rule.code,
        variant: rule.variant,
        name: rule.name,
        periodKey: period.key,
        periodLabel: fillLabel(period.label, fyStartYear),
        fyStartYear,
        periodStart: isoDate(startYear, period.startMonth, 1),
        periodEnd: isoDate(endYear, period.endMonth, lastDay(endYear, period.endMonth)),
        dueDate: isoDate(dueYear, period.dueMonth, period.dueDay),
      });
    }
  }
  drafts.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name) || a.periodKey.localeCompare(b.periodKey));
  return drafts;
}
