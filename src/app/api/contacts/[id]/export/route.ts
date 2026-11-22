import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await requireStaff();
  const { data: contact } = await session.supabase.from("contacts").select("*").eq("id", id).maybeSingle();
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: activities } = await session.supabase.from("activities").select("type, subject, due_at, created_at").eq("related_type", "contact").eq("related_id", id);
  return NextResponse.json({
    exported_at: new Date().toISOString(),
    purpose: "DPDP access request",
    contact,
    activities: activities ?? [],
  });
}
