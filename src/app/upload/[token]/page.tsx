import { notFound } from "next/navigation";
import { ActionForm, Submit } from "@/components/action-form";
import { createAdmin } from "@/lib/supabase/admin";
import { uploadWithToken } from "@/server/actions/practice";

export default async function UploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdmin();
  const { data: request } = await admin.from("document_requests").select("title, financial_year, status, firms(name)").eq("upload_token", token).maybeSingle();
  if (!request) notFound();
  const firm = Array.isArray(request.firms) ? request.firms[0] : request.firms;

  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{firm?.name}</p>
      <h1 className="font-display text-4xl">{request.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Financial year {request.financial_year}. Status: {request.status}.</p>
      <ActionForm action={uploadWithToken} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <input type="file" name="file" required className="text-sm" />
        <Submit>Upload</Submit>
      </ActionForm>
    </main>
  );
}
