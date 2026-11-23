import { NextResponse } from "next/server";
import { resolveAiCaller } from "@/lib/ai/gateway";
import { BriefingRequestSchema } from "@/lib/ai/schemas";
import { generateCustomerBriefing } from "@/server/ai-copilot";

export async function POST(request: Request) {
  const caller = await resolveAiCaller();
  if (!caller.ok) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const parsed = BriefingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Select a valid client account." }, { status: 400 });
  }

  const outcome = await generateCustomerBriefing(
    {
      supabase: caller.supabase,
      firm: caller.firm,
      profile: caller.profile,
      signal: request.signal,
    },
    parsed.data.accountId,
  );

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, requestId: outcome.requestId },
      { status: outcome.status },
    );
  }

  return NextResponse.json(outcome.body);
}
