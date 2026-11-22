export const INDIAN_STATES: Array<{ code: string; name: string }> = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman & Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

export const ENTITY_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "proprietorship", label: "Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "huf", label: "HUF" },
  { value: "llp", label: "LLP" },
  { value: "pvt_ltd", label: "Private limited" },
  { value: "public_ltd", label: "Public limited" },
  { value: "trust", label: "Trust" },
  { value: "society", label: "Society" },
] as const;

export const LEAD_SOURCES = ["walk-in", "referral", "website", "web-form", "whatsapp", "phone", "other"] as const;

export const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "converted"] as const;

export const SAC_CODES = [
  { code: "998222", label: "998222 · Accounting and bookkeeping" },
  { code: "998231", label: "998231 · Tax consultancy" },
  { code: "998221", label: "998221 · Financial auditing" },
] as const;

export function stateName(code: string | null | undefined): string {
  return INDIAN_STATES.find((state) => state.code === code)?.name ?? code ?? "—";
}

export function entityLabel(value: string | null | undefined): string {
  return ENTITY_TYPES.find((entity) => entity.value === value)?.label ?? value ?? "—";
}
