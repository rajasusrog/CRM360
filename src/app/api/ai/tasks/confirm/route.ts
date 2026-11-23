import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { resolveAiCaller } from "@/lib/ai/gateway";
import { ConfirmTasksRequestSchema } from "@/lib/ai/schemas";
import { confirmProposedTasks } from "@/server/ai-copilot";

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

  const parsed = ConfirmTasksRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid task confirmation payload." },
      { status: 400 },
    );
  }

  const outcome = await confirmProposedTasks(
    {
      supabase: caller.supabase,
      firm: caller.firm,
      profile: caller.profile,
    },
    parsed.data,
  );

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  revalidatePath("/activities");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  if (parsed.data.relatedType === "account" && parsed.data.relatedId) {
    revalidatePath(`/clients/${parsed.data.relatedId}`);
  } else if (parsed.data.relatedType === "lead" && parsed.data.relatedId) {
    revalidatePath(`/leads/${parsed.data.relatedId}`);
  }

  return NextResponse.json(outcome.body);
}
