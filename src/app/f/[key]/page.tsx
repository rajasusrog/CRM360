import { notFound } from "next/navigation";
import { ActionForm, Submit } from "@/components/action-form";
import { CheckField, Field, TextAreaField } from "@/components/kit";
import { createAdmin } from "@/lib/supabase/admin";
import { submitWebLead } from "@/server/actions/public";

export default async function WebFormPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const admin = createAdmin();
  const { data: form } = await admin.from("web_forms").select("name, public_key, firm_id, firms(name)").eq("public_key", key).eq("active", true).maybeSingle();
  if (!form) notFound();
  const firm = Array.isArray(form.firms) ? form.firms[0] : form.firms;

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{firm?.name ?? "Enquiry"}</p>
      <h1 className="font-display text-4xl">{form.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Tell us a little. We store this only with your consent.</p>
      <ActionForm action={submitWebLead} className="mt-6">
        <input type="hidden" name="public_key" value={form.public_key} />
        <input type="text" name="company_website" className="hidden" tabIndex={-1} autoComplete="off" />
        <Field label="First name" name="first_name" required />
        <Field label="Last name" name="last_name" />
        <Field label="Business" name="company" />
        <Field label="Mobile" name="phone" required />
        <Field label="Email" name="email" type="email" />
        <Field label="City" name="city" />
        <TextAreaField label="What do you need?" name="notes" />
        <CheckField label="I agree that the firm may store this enquiry so they can contact me." name="consent" />
        <Submit>Send</Submit>
      </ActionForm>
    </main>
  );
}
