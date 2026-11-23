/**
 * Controlled synthetic live-provider smoke test for UNIKORN360 AI Copilot.
 * Uses strictly fictional data and reads GEMINI_API_KEY / GEMINI_MODEL from process.env.
 * Does NOT touch production Supabase or CRM customer records.
 *
 * Run: GEMINI_API_KEY=... node --experimental-strip-types scripts/smoke-ai-copilot.ts
 */

import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-4-hydrogen";

  if (!apiKey) {
    console.log("SKIP: GEMINI_API_KEY is not set. Set GEMINI_API_KEY to run the live smoke test.");
    process.exit(0);
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: 20_000, headers: { "User-Agent": "aistudio-build" } },
  });

  console.log(`Running synthetic AI Copilot smoke test against model: ${model}`);

  const briefingRes = await ai.models.generateContent({
    model,
    contents: `<untrusted_crm_data label="client_dossier">${JSON.stringify({
      client: { sourceKey: "account:syn-acc-1", name: "Synthetic Textiles Pvt Ltd", entityType: "pvt_ltd", city: "Vellore" },
      deals: [{ sourceKey: "deal:syn-deal-1", name: "Statutory Audit FY26", stage: "Proposal", amountInr: 35000 }],
      filings: [{ sourceKey: "filing:syn-fil-1", name: "GSTR-3B", periodLabel: "Oct 2026", dueDate: "2026-11-20", status: "pending" }],
    })}</untrusted_crm_data>`,
    config: {
      systemInstruction:
        "Summarize only facts inside <untrusted_crm_data> and cite exact sourceKey values.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overviewSummary: { type: Type.STRING },
          citations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["overviewSummary", "citations"],
      },
      maxOutputTokens: 512,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  JSON.parse(briefingRes.text ?? "{}");
  console.log("PASS: Customer Briefing schema verified");

  const tamilRes = await ai.models.generateContent({
    model,
    contents: "Draft a polite short Tamil follow-up asking Synthetic Textiles to share October purchase invoices.",
    config: {
      systemInstruction: "Write natural business Tamil without inventing prices or dates.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING, nullable: true },
          draft: { type: Type.STRING },
        },
        required: ["subject", "draft"],
      },
      maxOutputTokens: 512,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  JSON.parse(tamilRes.text ?? "{}");
  console.log("PASS: Follow-up Tamil draft schema verified");

  const tasksRes = await ai.models.generateContent({
    model,
    contents:
      "Today (IST): 2026-11-23. Staff: [{id:'syn-staff-1', name:'Priya Demo'}]. Notes: Priya Demo to collect Oct purchase register tomorrow.",
    config: {
      systemInstruction: "Extract tasks with YYYY-MM-DD dueDate in IST and exact staff id when clear.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                assigneeId: { type: Type.STRING, nullable: true },
                dueDate: { type: Type.STRING, nullable: true },
              },
              required: ["title", "assigneeId", "dueDate"],
            },
          },
        },
        required: ["tasks"],
      },
      maxOutputTokens: 512,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  JSON.parse(tasksRes.text ?? "{}");
  console.log("PASS: Notes-to-Tasks extraction schema verified");
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
