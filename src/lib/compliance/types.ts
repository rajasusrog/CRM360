export type YearOffset = 0 | 1;

export type RulePeriod = {
  key: string;
  label: string;
  startMonth: number;
  startYearOffset: YearOffset;
  endMonth: number;
  endYearOffset: YearOffset;
  dueMonth: number;
  dueDay: number;
  dueYearOffset: YearOffset;
};

export type ComplianceRule = {
  code: string;
  variant: string;
  name: string;
  frequency: "monthly" | "quarterly" | "annual" | "installment";
  entityTypes: string[] | null;
  gstFrequencies: Array<"monthly" | "quarterly"> | null;
  requiresGstin: boolean;
  auditMode: "any" | "audit" | "non_audit";
  stateCodes: string[] | null;
  notes: string;
  periods: RulePeriod[];
};

export type ComplianceClient = {
  entityType: string;
  gstin: string | null;
  gstFilingFrequency: "monthly" | "quarterly" | null;
  stateCode: string;
  requiresAudit: boolean;
};

export type FilingDraft = {
  ruleCode: string;
  variant: string;
  name: string;
  periodKey: string;
  periodLabel: string;
  fyStartYear: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
};

export type StoredRule = ComplianceRule & { firmId: string | null };
