import { toCsv } from "@/lib/csv";
import { requireStaff } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ module: string }> }) {
  const { module } = await context.params;
  const session = await requireStaff();
  let csv = "";
  if (module === "leads") {
    const { data } = await session.supabase.from("leads").select("first_name, last_name, email, phone, company, source, status, city").eq("firm_id", session.firm.id);
    csv = toCsv(data ?? [], ["first_name", "last_name", "email", "phone", "company", "source", "status", "city"]);
  } else if (module === "contacts") {
    const { data } = await session.supabase.from("contacts").select("first_name, last_name, email, phone, designation").eq("firm_id", session.firm.id).is("deleted_at", null);
    csv = toCsv(data ?? [], ["first_name", "last_name", "email", "phone", "designation"]);
  } else if (module === "clients") {
    const { data } = await session.supabase.from("accounts").select("name, entity_type, pan, gstin, gst_filing_frequency, city, state_code, email, phone").eq("firm_id", session.firm.id);
    csv = toCsv(data ?? [], ["name", "entity_type", "pan", "gstin", "gst_filing_frequency", "city", "state_code", "email", "phone"]);
  } else {
    return new Response("Unknown module", { status: 404 });
  }
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${module}.csv"`,
    },
  });
}
