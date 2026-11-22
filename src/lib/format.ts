const IST = "Asia/Kolkata";

export function formatInr(rupees: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(rupees);
}

export function formatInrCompact(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(rupees);
}

/** Indian date, always in IST, e.g. 22 Nov 2026. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function todayIsoInIst(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentFyStartYear(now = new Date()): number {
  const iso = todayIsoInIst(now);
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  return month >= 4 ? year : year - 1;
}

export function fyLabel(startYear: number): string {
  return `FY ${startYear}-${String(startYear + 1).slice(2)}`;
}

/** Indian mobile: 10 digits starting 6-9. Accepts +91, 91, or a leading 0. */
export function normalizeIndianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let local = digits;
  if (digits.length === 12 && digits.startsWith("91")) local = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) local = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return local;
}

export function formatIndianMobile(input: string | null | undefined): string {
  if (!input) return "—";
  const local = normalizeIndianMobile(input);
  if (!local) return input;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

export function whatsAppLink(phone: string, text: string): string | null {
  const local = normalizeIndianMobile(phone);
  if (!local) return null;
  return `https://wa.me/91${local}?text=${encodeURIComponent(text)}`;
}
