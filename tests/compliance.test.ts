import { describe, expect, it } from "vitest";
import { generateFilings, resolveRules } from "../src/lib/compliance/generate";
import { SYSTEM_RULES } from "../src/lib/compliance/rules";
import type { ComplianceClient, StoredRule } from "../src/lib/compliance/types";

const FY = 2026;

function due(client: ComplianceClient, code: string, periodKey?: string) {
  return generateFilings(SYSTEM_RULES, client, FY).filter(
    (filing) => filing.ruleCode === code && (periodKey ? filing.periodKey === periodKey : true),
  );
}

const tnMonthly: ComplianceClient = {
  entityType: "proprietorship",
  gstin: "33AELPL4412D1Z5",
  gstFilingFrequency: "monthly",
  stateCode: "33",
  requiresAudit: false,
};

describe("compliance due dates", () => {
  it("builds monthly GSTR-1 on the 11th and skips quarterly returns", () => {
    const gstr1 = due(tnMonthly, "GSTR1");
    expect(gstr1).toHaveLength(12);
    expect(gstr1.find((row) => row.periodKey === "M04")?.dueDate).toBe("2026-05-11");
    expect(gstr1.find((row) => row.periodKey === "M12")?.dueDate).toBe("2027-01-11");
    expect(gstr1.find((row) => row.periodKey === "M03")?.dueDate).toBe("2027-04-11");
    expect(gstr1.some((row) => row.periodKey.startsWith("Q"))).toBe(false);
    expect(due(tnMonthly, "GSTR3B").find((row) => row.periodKey === "M04")?.dueDate).toBe("2026-05-20");
  });

  it("uses the 22nd QRMP date in Tamil Nadu and the 24th in Delhi", () => {
    const quarterlyTn: ComplianceClient = { ...tnMonthly, gstFilingFrequency: "quarterly" };
    const gstr1 = due(quarterlyTn, "GSTR1");
    expect(gstr1.map((row) => row.periodKey)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(gstr1[0].dueDate).toBe("2026-07-13");
    expect(due(quarterlyTn, "GSTR3B").find((row) => row.periodKey === "Q1")?.dueDate).toBe("2026-07-22");

    const delhi: ComplianceClient = { ...quarterlyTn, stateCode: "07" };
    expect(due(delhi, "GSTR3B").find((row) => row.periodKey === "Q2")?.dueDate).toBe("2026-10-24");
    expect(due(quarterlyTn, "MCA_AOC4")).toHaveLength(0);
  });

  it("puts TDS Q4 on 31 May and advance tax on 15 June", () => {
    expect(due(tnMonthly, "TDS", "Q4")[0].dueDate).toBe("2027-05-31");
    expect(due(tnMonthly, "TDS", "Q1")[0].dueDate).toBe("2026-07-31");
    expect(due(tnMonthly, "ADV_TAX", "ADV1")[0].dueDate).toBe("2026-06-15");
    expect(due(tnMonthly, "ADV_TAX", "ADV4")[0].dueDate).toBe("2027-03-15");
  });

  it("files company ROC dates and the audit ITR, not the July ITR", () => {
    const company: ComplianceClient = {
      entityType: "pvt_ltd",
      gstin: "33AABCM2187Q1ZX",
      gstFilingFrequency: "monthly",
      stateCode: "33",
      requiresAudit: true,
    };
    expect(due(company, "MCA_AOC4")[0].dueDate).toBe("2027-10-30");
    expect(due(company, "MCA_MGT7")[0].dueDate).toBe("2027-11-29");
    expect(due(company, "ITR")).toHaveLength(1);
    expect(due(company, "ITR")[0].dueDate).toBe("2027-10-31");
    expect(due(company, "LLP_8")).toHaveLength(0);
  });

  it("keeps a non-GST individual off the GST and TDS calendars", () => {
    const person: ComplianceClient = {
      entityType: "individual",
      gstin: null,
      gstFilingFrequency: null,
      stateCode: "33",
      requiresAudit: false,
    };
    const filings = generateFilings(SYSTEM_RULES, person, FY);
    expect(filings.some((row) => row.ruleCode.startsWith("GSTR") || row.ruleCode === "TDS")).toBe(false);
    expect(due(person, "ITR")[0].dueDate).toBe("2027-07-31");
    expect(due(person, "ADV_TAX")).toHaveLength(4);
  });

  it("lets a firm rule replace the system due day", () => {
    const override: StoredRule = {
      ...SYSTEM_RULES.find((rule) => rule.code === "GSTR1" && rule.variant === "monthly")!,
      firmId: "firm-1",
      periods: SYSTEM_RULES.find((rule) => rule.code === "GSTR1" && rule.variant === "monthly")!.periods.map((period) =>
        period.key === "M04" ? { ...period, dueDay: 13 } : period,
      ),
    };
    const rows: StoredRule[] = [
      ...SYSTEM_RULES.map((rule) => ({ ...rule, firmId: null })),
      override,
    ];
    const rules = resolveRules(rows, "firm-1");
    const april = generateFilings(rules, tnMonthly, FY).find((row) => row.ruleCode === "GSTR1" && row.periodKey === "M04");
    expect(april?.dueDate).toBe("2026-05-13");
    expect(rules.filter((rule) => rule.code === "GSTR1" && rule.variant === "monthly")).toHaveLength(1);
  });
});
