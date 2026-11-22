import type { ComplianceRule, RulePeriod, YearOffset } from "./types";

const FY_MONTHS: Array<{ m: number; off: YearOffset; name: string }> = [
  { m: 4, off: 0, name: "Apr" },
  { m: 5, off: 0, name: "May" },
  { m: 6, off: 0, name: "Jun" },
  { m: 7, off: 0, name: "Jul" },
  { m: 8, off: 0, name: "Aug" },
  { m: 9, off: 0, name: "Sep" },
  { m: 10, off: 0, name: "Oct" },
  { m: 11, off: 0, name: "Nov" },
  { m: 12, off: 0, name: "Dec" },
  { m: 1, off: 1, name: "Jan" },
  { m: 2, off: 1, name: "Feb" },
  { m: 3, off: 1, name: "Mar" },
];

/** Due on a fixed day of the month after the tax period. December rolls into January of the next offset. */
function monthly(dueDay: number): RulePeriod[] {
  return FY_MONTHS.map((month) => {
    const rolls = month.m === 12;
    const dueYearOffset = (rolls ? month.off + 1 : month.off) as YearOffset;
    return {
      key: `M${String(month.m).padStart(2, "0")}`,
      label: `${month.name} {{y${month.off}}}`,
      startMonth: month.m,
      startYearOffset: month.off,
      endMonth: month.m,
      endYearOffset: month.off,
      dueMonth: rolls ? 1 : month.m + 1,
      dueDay,
      dueYearOffset,
    };
  });
}

const QUARTERS = [
  { key: "Q1", label: "Q1 {{fy}} (Apr–Jun)", startMonth: 4, startYearOffset: 0 as const, endMonth: 6, endYearOffset: 0 as const },
  { key: "Q2", label: "Q2 {{fy}} (Jul–Sep)", startMonth: 7, startYearOffset: 0 as const, endMonth: 9, endYearOffset: 0 as const },
  { key: "Q3", label: "Q3 {{fy}} (Oct–Dec)", startMonth: 10, startYearOffset: 0 as const, endMonth: 12, endYearOffset: 0 as const },
  { key: "Q4", label: "Q4 {{fy}} (Jan–Mar)", startMonth: 1, startYearOffset: 1 as const, endMonth: 3, endYearOffset: 1 as const },
] ;

function quarterly(dues: Array<{ month: number; day: number; yearOffset: YearOffset }>): RulePeriod[] {
  return QUARTERS.map((quarter, index) => {
    const due = dues[index];
    return {
      key: quarter.key,
      label: quarter.label,
      startMonth: quarter.startMonth,
      startYearOffset: quarter.startYearOffset,
      endMonth: quarter.endMonth,
      endYearOffset: quarter.endYearOffset,
      dueMonth: due.month,
      dueDay: due.day,
      dueYearOffset: due.yearOffset,
    };
  });
}

function annual(label: string, dueMonth: number, dueDay: number, dueYearOffset: YearOffset): RulePeriod[] {
  return [
    {
      key: "FY",
      label,
      startMonth: 4,
      startYearOffset: 0,
      endMonth: 3,
      endYearOffset: 1,
      dueMonth,
      dueDay,
      dueYearOffset,
    },
  ];
}

/** QRMP GSTR-3B states due on the 22nd (CBIC category, includes Tamil Nadu). */
export const GSTR3B_DUE_22_STATES = ["22", "23", "24", "26", "27", "29", "30", "31", "32", "33", "34", "35", "36", "37"];

/** Remaining states and UTs, due on the 24th. */
export const GSTR3B_DUE_24_STATES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "38"];

const NEXT_MONTH_13: Array<{ month: number; day: number; yearOffset: YearOffset }> = [
  { month: 7, day: 13, yearOffset: 0 },
  { month: 10, day: 13, yearOffset: 0 },
  { month: 1, day: 13, yearOffset: 1 },
  { month: 4, day: 13, yearOffset: 1 },
];

function qrmp3b(day: number): Array<{ month: number; day: number; yearOffset: YearOffset }> {
  return [
    { month: 7, day, yearOffset: 0 },
    { month: 10, day, yearOffset: 0 },
    { month: 1, day, yearOffset: 1 },
    { month: 4, day, yearOffset: 1 },
  ];
}

const TDS_DUES: Array<{ month: number; day: number; yearOffset: YearOffset }> = [
  { month: 7, day: 31, yearOffset: 0 },
  { month: 10, day: 31, yearOffset: 0 },
  { month: 1, day: 31, yearOffset: 1 },
  { month: 5, day: 31, yearOffset: 1 },
];

const BUSINESS = ["proprietorship", "partnership", "huf", "llp", "pvt_ltd", "public_ltd", "trust", "society"];
const COMPANIES = ["pvt_ltd", "public_ltd"];
const NON_AUDIT_ENTITIES = ["individual", "proprietorship", "huf", "partnership", "trust", "society"];
const AUDIT_ENTITIES = ["partnership", "llp", "pvt_ltd", "public_ltd", "trust", "society"];

/**
 * System due-date rules. Firms override a variant by inserting their own row;
 * the generator prefers the firm row. Dates live here, not in application branches,
 * because CBIC and CBDT notifications move them.
 */
export const SYSTEM_RULES: ComplianceRule[] = [
  {
    code: "GSTR1",
    variant: "monthly",
    name: "GSTR-1",
    frequency: "monthly",
    entityTypes: null,
    gstFrequencies: ["monthly"],
    requiresGstin: true,
    auditMode: "any",
    stateCodes: null,
    notes: "Monthly statement of outward supplies. Due on the 11th of the following month.",
    periods: monthly(11),
  },
  {
    code: "GSTR1",
    variant: "quarterly",
    name: "GSTR-1 (QRMP)",
    frequency: "quarterly",
    entityTypes: null,
    gstFrequencies: ["quarterly"],
    requiresGstin: true,
    auditMode: "any",
    stateCodes: null,
    notes: "Quarterly GSTR-1 for QRMP taxpayers. Due on the 13th of the month after the quarter.",
    periods: quarterly(NEXT_MONTH_13),
  },
  {
    code: "GSTR3B",
    variant: "monthly",
    name: "GSTR-3B",
    frequency: "monthly",
    entityTypes: null,
    gstFrequencies: ["monthly"],
    requiresGstin: true,
    auditMode: "any",
    stateCodes: null,
    notes: "Monthly summary return. Due on the 20th of the following month.",
    periods: monthly(20),
  },
  {
    code: "GSTR3B",
    variant: "qrmp-22",
    name: "GSTR-3B (QRMP)",
    frequency: "quarterly",
    entityTypes: null,
    gstFrequencies: ["quarterly"],
    requiresGstin: true,
    auditMode: "any",
    stateCodes: GSTR3B_DUE_22_STATES,
    notes: "QRMP GSTR-3B for category states including Tamil Nadu. Due on the 22nd.",
    periods: quarterly(qrmp3b(22)),
  },
  {
    code: "GSTR3B",
    variant: "qrmp-24",
    name: "GSTR-3B (QRMP)",
    frequency: "quarterly",
    entityTypes: null,
    gstFrequencies: ["quarterly"],
    requiresGstin: true,
    auditMode: "any",
    stateCodes: GSTR3B_DUE_24_STATES,
    notes: "QRMP GSTR-3B for the remaining states and Delhi. Due on the 24th.",
    periods: quarterly(qrmp3b(24)),
  },
  {
    code: "TDS",
    variant: "quarterly",
    name: "TDS return (24Q/26Q)",
    frequency: "quarterly",
    entityTypes: BUSINESS,
    gstFrequencies: null,
    requiresGstin: false,
    auditMode: "any",
    stateCodes: null,
    notes: "Quarterly TDS statements. Q4 is due on 31 May, not the month after March.",
    periods: quarterly(TDS_DUES),
  },
  {
    code: "ADV_TAX",
    variant: "installments",
    name: "Advance tax",
    frequency: "installment",
    entityTypes: null,
    gstFrequencies: null,
    requiresGstin: false,
    auditMode: "any",
    stateCodes: null,
    notes: "15 June 15%, 15 September 45%, 15 December 75%, 15 March 100%.",
    periods: [
      { key: "ADV1", label: "15 Jun {{y0}} · 15%", startMonth: 4, startYearOffset: 0, endMonth: 6, endYearOffset: 0, dueMonth: 6, dueDay: 15, dueYearOffset: 0 },
      { key: "ADV2", label: "15 Sep {{y0}} · 45%", startMonth: 7, startYearOffset: 0, endMonth: 9, endYearOffset: 0, dueMonth: 9, dueDay: 15, dueYearOffset: 0 },
      { key: "ADV3", label: "15 Dec {{y0}} · 75%", startMonth: 10, startYearOffset: 0, endMonth: 12, endYearOffset: 0, dueMonth: 12, dueDay: 15, dueYearOffset: 0 },
      { key: "ADV4", label: "15 Mar {{y1}} · 100%", startMonth: 1, startYearOffset: 1, endMonth: 3, endYearOffset: 1, dueMonth: 3, dueDay: 15, dueYearOffset: 1 },
    ],
  },
  {
    code: "ITR",
    variant: "non-audit",
    name: "Income-tax return",
    frequency: "annual",
    entityTypes: NON_AUDIT_ENTITIES,
    gstFrequencies: null,
    requiresGstin: false,
    auditMode: "non_audit",
    stateCodes: null,
    notes: "Non-audit return. Default due date 31 July of the assessment year. Extend by editing the rule when CBDT notifies.",
    periods: annual("ITR {{fy}}", 7, 31, 1),
  },
  {
    code: "ITR",
    variant: "audit",
    name: "Income-tax return (audit)",
    frequency: "annual",
    entityTypes: AUDIT_ENTITIES,
    gstFrequencies: null,
    requiresGstin: false,
    auditMode: "audit",
    stateCodes: null,
    notes: "Audit cases. Default due date 31 October.",
    periods: annual("ITR (audit) {{fy}}", 10, 31, 1),
  },
  {
    code: "MCA_AOC4",
    variant: "annual",
    name: "AOC-4",
    frequency: "annual",
    entityTypes: COMPANIES,
    gstFrequencies: null,
    requiresGstin: false,
    auditMode: "any",
    stateCodes: null,
    notes: "Financial statements with ROC. Default assumes AGM by 30 September, filing within 30 days (30 October).",
    periods: annual("AOC-4 {{fy}}", 10, 30, 1),
  },
  {
    code: "MCA_MGT7",
    variant: "annual",
    name: "MGT-7",
    frequency: "annual",
    entityTypes: COMPANIES,
    gstFrequencies: null,
    requiresGstin: false,
    auditMode: "any",
    stateCodes: null,
    notes: "Annual return with ROC. Default assumes 60 days from a 30 September AGM (29 November).",
    periods: annual("MGT-7 {{fy}}", 11, 29, 1),
  },
  {
    code: "LLP_8",
    variant: "annual",
    name: "LLP Form 8",
    frequency: "annual",
    entityTypes: ["llp"],
    gstFrequencies: null,
    requiresGstin: false,
    auditMode: "any",
    stateCodes: null,
    notes: "Statement of Account & Solvency. Due 30 October.",
    periods: annual("LLP Form 8 {{fy}}", 10, 30, 1),
  },
  {
    code: "LLP_11",
    variant: "annual",
    name: "LLP Form 11",
    frequency: "annual",
    entityTypes: ["llp"],
    gstFrequencies: null,
    requiresGstin: false,
    auditMode: "any",
    stateCodes: null,
    notes: "Annual return of LLP. Due 30 May.",
    periods: annual("LLP Form 11 {{fy}}", 5, 30, 1),
  },
];
