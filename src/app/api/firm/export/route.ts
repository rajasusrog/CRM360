import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/session";

export async function GET() {
  const session = await requireStaff();
  if (session.profile.role !== "owner") return NextResponse.json({ error: "Only the owner can export the firm." }, { status: 403 });
  const firmId = session.firm.id;
  const [accounts, contacts, leads, invoices, filings] = await Promise.all([
    session.supabase.from("accounts").select("*").eq("firm_id", firmId),
    session.supabase.from("contacts").select("*").eq("firm_id", firmId),
    session.supabase.from("leads").select("*").eq("firm_id", firmId),
    session.supabase.from("invoices").select("*").eq("firm_id", firmId),
    session.supabase.from("compliance_filings").select("*").eq("firm_id", firmId),
  ]);
  return NextResponse.json({
    exported_at: new Date().toISOString(),
    firm: session.firm,
    accounts: accounts.data,
    contacts: contacts.data,
    leads: leads.data,
    invoices: invoices.data,
    filings: filings.data,
  });
}
