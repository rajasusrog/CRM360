const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** GSTIN body without the checksum character: 2-digit state + PAN + entity + Z. */
const BODY = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z$/;
const FULL = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Check digit from the GSTN algorithm (ISO 7064 Mod 36, 2).
 * Factor starts at 2 on the rightmost character of the 14-char body and alternates 2, 1.
 */
export function gstinCheckDigit(body: string): string {
  const normalized = body.trim().toUpperCase();
  if (!BODY.test(normalized)) {
    throw new Error("GSTIN body must be 14 characters in the state + PAN + entity + Z shape.");
  }
  let factor = 2;
  let sum = 0;
  for (let i = normalized.length - 1; i >= 0; i--) {
    const codePoint = CHARSET.indexOf(normalized[i]);
    let digit = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    digit = Math.floor(digit / 36) + (digit % 36);
    sum += digit;
  }
  const checkCodePoint = (36 - (sum % 36)) % 36;
  return CHARSET[checkCodePoint];
}

export function withGstinChecksum(body: string): string {
  return body.trim().toUpperCase() + gstinCheckDigit(body);
}

export type GstinResult =
  | { ok: true; gstin: string; stateCode: string; pan: string }
  | { ok: false; reason: string };

export function validateGstin(input: string): GstinResult {
  const gstin = input.trim().toUpperCase();
  if (!gstin) return { ok: false, reason: "GSTIN is required." };
  if (gstin.length !== 15) return { ok: false, reason: "GSTIN must be 15 characters." };
  if (!FULL.test(gstin)) {
    return { ok: false, reason: "GSTIN does not match the state, PAN, entity, and Z pattern." };
  }
  const expected = gstinCheckDigit(gstin.slice(0, 14));
  if (gstin[14] !== expected) {
    return { ok: false, reason: `Checksum is invalid. Expected ${expected}.` };
  }
  return { ok: true, gstin, stateCode: gstin.slice(0, 2), pan: gstin.slice(2, 12) };
}

export function isValidGstin(input: string): boolean {
  return validateGstin(input).ok;
}
