import { getSession } from "@/lib/session";
import { createAdmin } from "@/lib/supabase/admin";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getSession();
  if (!session.user) return new Response("Sign in required", { status: 401 });
  const admin = createAdmin();
  const { data: document } = await admin.from("documents").select("*").eq("id", id).maybeSingle();
  if (!document) return new Response("Not found", { status: 404 });
  const staffOk = session.profile && session.profile.firm_id === document.firm_id;
  const clientOk = session.client && session.client.account_id === document.account_id && document.client_visible;
  if (!staffOk && !clientOk) return new Response("Not found", { status: 404 });
  const { data, error } = await admin.storage.from("crmpro_documents").download(document.storage_path);
  if (error || !data) return new Response("File is not in storage yet.", { status: 404 });
  const bytes = new Uint8Array(await data.arrayBuffer());
  return new Response(bytes, {
    headers: {
      "Content-Type": document.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${document.name}"`,
    },
  });
}
