import { requireClient } from "@/lib/session";

export default async function PortalDocuments() {
  const session = await requireClient();
  const [{ data: documents }, { data: requests }] = await Promise.all([
    session.supabase.from("documents").select("id, name, folder, financial_year").eq("account_id", session.client.account_id).eq("client_visible", true),
    session.supabase.from("document_requests").select("title, status, upload_token").eq("account_id", session.client.account_id),
  ]);
  return (
    <div>
      <h1 className="font-display text-4xl">Documents</h1>
      <ul className="mt-4 text-sm">
        {(documents ?? []).map((document) => (
          <li key={document.id}><a className="underline" href={`/api/documents/${document.id}`}>{document.financial_year} · {document.folder} · {document.name}</a></li>
        ))}
      </ul>
      <h2 className="mt-6 font-display text-2xl">Still needed</h2>
      <ul className="mt-2 text-sm">
        {(requests ?? []).filter((request) => request.status === "requested").map((request) => (
          <li key={request.upload_token}><a className="underline" href={`/upload/${request.upload_token}`}>{request.title}</a></li>
        ))}
      </ul>
    </div>
  );
}
