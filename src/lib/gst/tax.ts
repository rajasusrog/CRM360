/** Standard rate on CA practice services (accounting, bookkeeping, tax consultancy). */
export const GST_RATE_PERCENT = 18;

export type TaxSplit = {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  totalPaise: number;
  intraState: boolean;
};

function assertPaise(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of paise.`);
  }
}

/**
 * Split 18% GST into CGST+SGST (same state, including same UT) or IGST (inter-state).
 * Amounts are integer paise. An odd tax total leaves the extra paisa on SGST.
 */
export function splitGst(taxablePaise: number, firmStateCode: string, placeOfSupply: string): TaxSplit {
  assertPaise(taxablePaise, "Taxable value");
  const firm = firmStateCode.trim();
  const pos = placeOfSupply.trim();
  if (!/^[0-9]{2}$/.test(firm) || !/^[0-9]{2}$/.test(pos)) {
    throw new Error("State codes must be 2-digit GST codes.");
  }
  const taxPaise = Math.round((taxablePaise * GST_RATE_PERCENT) / 100);
  const intraState = firm === pos;
  if (intraState) {
    const cgstPaise = Math.floor(taxPaise / 2);
    const sgstPaise = taxPaise - cgstPaise;
    return {
      taxablePaise,
      cgstPaise,
      sgstPaise,
      igstPaise: 0,
      taxPaise,
      totalPaise: taxablePaise + taxPaise,
      intraState: true,
    };
  }
  return {
    taxablePaise,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: taxPaise,
    taxPaise,
    totalPaise: taxablePaise + taxPaise,
    intraState: false,
  };
}

export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees < 0) {
    throw new Error("Amount must be a non-negative number of rupees.");
  }
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  assertPaise(paise, "Amount");
  return paise / 100;
}
