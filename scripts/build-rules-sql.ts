import { writeFileSync } from "node:fs";
import { SYSTEM_RULES } from "../src/lib/compliance/rules.ts";

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function textArray(values: string[] | null): string {
  if (!values) return "null";
  return `array[${values.map(sql).join(", ")}]::text[]`;
}

const lines: string[] = [
  "-- Generated from src/lib/compliance/rules.ts. Re-run: node --experimental-strip-types scripts/build-rules-sql.ts",
  "insert into public.compliance_rules (id, firm_id, code, variant, name, frequency, entity_types, gst_frequencies, requires_gstin, audit_mode, state_codes, notes)",
  "values",
];

const ruleIds = SYSTEM_RULES.map((_, index) => `d1000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

lines.push(
  SYSTEM_RULES.map((rule, index) => {
    return `  ('${ruleIds[index]}', null, ${sql(rule.code)}, ${sql(rule.variant)}, ${sql(rule.name)}, ${sql(rule.frequency)}, ${textArray(rule.entityTypes)}, ${textArray(rule.gstFrequencies)}, ${rule.requiresGstin}, ${sql(rule.auditMode)}, ${textArray(rule.stateCodes)}, ${sql(rule.notes)})`;
  }).join(",\n") + ";",
);

lines.push(
  "insert into public.compliance_rule_periods (rule_id, period_key, label, start_month, start_year_offset, end_month, end_year_offset, due_month, due_day, due_year_offset, sort)",
  "values",
);

const periodRows: string[] = [];
SYSTEM_RULES.forEach((rule, ruleIndex) => {
  rule.periods.forEach((period, periodIndex) => {
    periodRows.push(
      `  ('${ruleIds[ruleIndex]}', ${sql(period.key)}, ${sql(period.label)}, ${period.startMonth}, ${period.startYearOffset}, ${period.endMonth}, ${period.endYearOffset}, ${period.dueMonth}, ${period.dueDay}, ${period.dueYearOffset}, ${periodIndex + 1})`,
    );
  });
});
lines.push(periodRows.join(",\n") + ";");

writeFileSync(new URL("../supabase/migrations/20261122102000_compliance_rules.sql", import.meta.url), lines.join("\n") + "\n");
console.log(`wrote ${SYSTEM_RULES.length} rules and ${periodRows.length} periods`);
