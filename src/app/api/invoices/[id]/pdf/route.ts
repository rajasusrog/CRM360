import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { getSession } from "@/lib/session";
import { createAdmin } from "@/lib/supabase/admin";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getSession();
  if (!session.user) return new Response("Sign in required", { status: 401 });

  const supabase = session.client ? createAdmin() : session.supabase;
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!invoice) return new Response("Not found", { status: 404 });
  if (session.client && session.client.account_id !== invoice.account_id) return new Response("Not found", { status: 404 });
  if (session.profile && session.profile.firm_id !== invoice.firm_id) return new Response("Not found", { status: 404 });
  if (invoice.status === "draft" && session.client) return new Response("Not found", { status: 404 });

  const [{ data: firm }, { data: client }] = await Promise.all([
    supabase.from("firms").select("name, address, city, gstin, state_code, email, phone").eq("id", invoice.firm_id).single(),
    supabase.from("accounts").select("name, address, city, gstin, state_code").eq("id", invoice.account_id).single(),
  ]);
  if (!firm || !client) return new Response("Not found", { status: 404 });
  const pdf = await renderInvoicePdf({ firm, client, invoice });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number.replaceAll("/", "-")}.pdf"`,
    },
  });
}
