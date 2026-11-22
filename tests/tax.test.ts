import { describe, expect, it } from "vitest";
import { paiseToRupees, rupeesToPaise, splitGst } from "../src/lib/gst/tax";

describe("GST invoice tax split", () => {
  it("splits 18% into equal CGST and SGST inside Tamil Nadu", () => {
    const split = splitGst(rupeesToPaise(10000), "33", "33");
    expect(split.intraState).toBe(true);
    expect(split.taxPaise).toBe(180000);
    expect(split.cgstPaise).toBe(90000);
    expect(split.sgstPaise).toBe(90000);
    expect(split.igstPaise).toBe(0);
    expect(paiseToRupees(split.totalPaise)).toBe(11800);
  });

  it("charges IGST when the place of supply is another state", () => {
    const split = splitGst(rupeesToPaise(25000), "33", "29");
    expect(split.intraState).toBe(false);
    expect(split.igstPaise).toBe(450000);
    expect(split.cgstPaise).toBe(0);
    expect(split.sgstPaise).toBe(0);
    expect(paiseToRupees(split.totalPaise)).toBe(29500);
  });

  it("gives the odd paisa of an uneven tax total to CGST", () => {
    const split = splitGst(1, "33", "33");
    expect(split.taxPaise).toBe(0);
    const odd = splitGst(rupeesToPaise(10.05), "33", "33");
    expect(odd.taxPaise % 2).toBe(1);
    expect(odd.cgstPaise + odd.sgstPaise).toBe(odd.taxPaise);
    expect(odd.sgstPaise).toBe(odd.cgstPaise + 1);
  });

  it("treats the same union territory code as intra-state", () => {
    expect(splitGst(rupeesToPaise(1000), "34", "34").intraState).toBe(true);
  });
});
