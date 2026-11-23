import { NextResponse } from "next/server";
import { resolveAiCaller } from "@/lib/ai/gateway";
import { NotesToTasksRequestSchema } from "@/lib/ai/schemas";
import { extractTasksFromNotes } from "@/server/ai-copilot";

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

  const parsed = NotesToTasksRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid notes input." },
      { status: 400 },
    );
  }

  const outcome = await extractTasksFromNotes(
    {
      supabase: caller.supabase,
      firm: caller.firm,
      profile: caller.profile,
      signal: request.signal,
    },
    parsed.data,
  );

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, requestId: outcome.requestId },
      { status: outcome.status },
    );
  }

  return NextResponse.json(outcome.body);
}
