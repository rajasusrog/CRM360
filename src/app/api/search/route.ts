import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/session";

export async function GET(request: Request) {
  const session = await requireStaff();
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json([]);
  const like = `%${query}%`;
  const [leads, contacts, accounts, invoices] = await Promise.all([
    session.supabase.from("leads").select("id, first_name, last_name, company").or(`first_name.ilike.${like},last_name.ilike.${like},company.ilike.${like}`).limit(6),
    session.supabase.from("contacts").select("id, first_name, last_name").or(`first_name.ilike.${like},last_name.ilike.${like}`).is("deleted_at", null).limit(6),
    session.supabase.from("accounts").select("id, name").ilike("name", like).limit(6),
    session.supabase.from("invoices").select("id, invoice_number").ilike("invoice_number", like).limit(6),
  ]);
  const results = [
    ...(leads.data ?? []).map((row) => ({ href: `/leads/${row.id}`, label: `${row.first_name} ${row.last_name ?? ""} ${row.company ?? ""}`.trim(), kind: "Lead" })),
    ...(contacts.data ?? []).map((row) => ({ href: `/contacts/${row.id}`, label: `${row.first_name} ${row.last_name ?? ""}`.trim(), kind: "Contact" })),
    ...(accounts.data ?? []).map((row) => ({ href: `/clients/${row.id}`, label: row.name, kind: "Client" })),
    ...(invoices.data ?? []).map((row) => ({ href: `/invoices/${row.id}`, label: row.invoice_number, kind: "Invoice" })),
  ];
  return NextResponse.json(results);
}
