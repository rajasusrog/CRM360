import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatDate, formatInr } from "@/lib/format";
import { stateName } from "@/lib/constants";

export type InvoicePdfInput = {
  firm: { name: string; address: string | null; city: string | null; gstin: string | null; state_code: string; email: string | null; phone: string | null };
  client: { name: string; address: string | null; city: string | null; gstin: string | null; state_code: string };
  invoice: {
    invoice_number: string;
    invoice_date: string;
    due_date: string | null;
    place_of_supply: string;
    sac_code: string;
    description: string;
    taxable_value: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
    status: string;
    notes: string | null;
  };
};

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const ink = rgb(0.12, 0.18, 0.16);
  const muted = rgb(0.35, 0.38, 0.36);
  let y = 800;
  const draw = (value: string, x: number, size = 11, useBold = false, color = ink) => {
    const text = value.replaceAll("₹", "Rs ").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color });
  };

  draw("TAX INVOICE", 48, 18, true);
  y -= 22;
  draw(input.firm.name, 48, 13, true);
  y -= 16;
  const firmLines = [input.firm.address, [input.firm.city, stateName(input.firm.state_code)].filter(Boolean).join(", "), input.firm.gstin ? `GSTIN ${input.firm.gstin}` : null, input.firm.email, input.firm.phone].filter(Boolean) as string[];
  for (const line of firmLines) {
    draw(line, 48, 10, false, muted);
    y -= 14;
  }

  y -= 10;
  draw(`Invoice ${input.invoice.invoice_number}`, 48, 12, true);
  draw(input.invoice.status.toUpperCase(), 460, 12, true);
  y -= 16;
  draw(`Date ${formatDate(input.invoice.invoice_date)}`, 48, 10, false, muted);
  draw(`Due ${formatDate(input.invoice.due_date)}`, 220, 10, false, muted);
  y -= 22;
  draw("Bill to", 48, 10, true, muted);
  y -= 16;
  draw(input.client.name, 48, 12, true);
  y -= 15;
  for (const line of [input.client.address, input.client.city, input.client.gstin ? `GSTIN ${input.client.gstin}` : null, `Place of supply ${stateName(input.invoice.place_of_supply)} (${input.invoice.place_of_supply})`].filter(Boolean) as string[]) {
    draw(line, 48, 10, false, muted);
    y -= 14;
  }

  y -= 16;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 0.6, color: rgb(0.75, 0.7, 0.62) });
  y -= 20;
  draw("Description", 48, 10, true);
  draw("SAC", 320, 10, true);
  draw("Amount", 470, 10, true);
  y -= 8;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 0.4, color: rgb(0.75, 0.7, 0.62) });
  y -= 18;
  draw(input.invoice.description.slice(0, 70), 48, 11);
  draw(input.invoice.sac_code, 320, 11);
  draw(formatInr(Number(input.invoice.taxable_value)), 430, 11);
  y -= 28;
  const rows: Array<[string, number]> = [
    ["Taxable value", Number(input.invoice.taxable_value)],
    ["CGST 9%", Number(input.invoice.cgst)],
    ["SGST 9%", Number(input.invoice.sgst)],
    ["IGST 18%", Number(input.invoice.igst)],
  ];
  for (const [label, amount] of rows) {
    if (label !== "Taxable value" && amount === 0) continue;
    draw(label, 320, 10, false, muted);
    draw(formatInr(amount), 460, 10);
    y -= 16;
  }
  y -= 6;
  draw("Total", 320, 12, true);
  draw(formatInr(Number(input.invoice.total)), 450, 12, true);
  y -= 28;
  draw("Amount in INR. Tax is split from the place of supply against the firm's state.", 48, 9, false, muted);
  if (input.invoice.notes) {
    y -= 16;
    draw(input.invoice.notes.slice(0, 110), 48, 10);
  }
  y = 64;
  draw("This is a computer-generated invoice from Unikorn360.", 48, 9, false, muted);
  return doc.save();
}
