import { describe, expect, it } from "vitest";
import { gstinCheckDigit, isValidGstin, validateGstin, withGstinChecksum } from "../src/lib/gst/gstin";

describe("GSTIN", () => {
  it("computes a stable check digit and accepts the full number", () => {
    const body = "33AABCM2187Q1Z";
    const digit = gstinCheckDigit(body);
    const gstin = withGstinChecksum(body);
    expect(gstin).toBe(body + digit);
    expect(isValidGstin(gstin)).toBe(true);
    expect(validateGstin(gstin.toLowerCase())).toMatchObject({ ok: true, stateCode: "33", pan: "AABCM2187Q" });
  });

  it("rejects a transposed checksum", () => {
    const gstin = withGstinChecksum("33AAFFK4821M1Z");
    const broken = gstin.slice(0, 14) + (gstin[14] === "A" ? "B" : "A");
    const result = validateGstin(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Checksum/);
  });

  it("rejects malformed values", () => {
    expect(validateGstin("").ok).toBe(false);
    expect(validateGstin("33AABCM2187Q1Z").ok).toBe(false);
    expect(validateGstin("3XAABCM2187Q1Z0").ok).toBe(false);
    expect(validateGstin("33AABCM2187Q0Z5").ok).toBe(false);
  });
});
