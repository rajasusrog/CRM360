import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/action-form";
import { Field, SelectField } from "@/components/kit";
import { INDIAN_STATES } from "@/lib/constants";
import { getSession, resolveAuthDestination } from "@/lib/session";
import { createFirm } from "@/server/actions/auth";

export default async function OnboardingPage() {
  const session = await getSession();
  if (session.state !== "no_membership") {
    redirect(resolveAuthDestination(session));
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">New firm</p>
      <h1 className="mt-2 font-display text-4xl">Set up the practice.</h1>
      <p className="mt-2 text-sm text-muted-foreground">You become the owner. A 14-day Growth trial starts now. Tamil Nadu is the default state.</p>
      <ActionForm action={createFirm} className="mt-6">
        <Field label="Firm name" name="name" required placeholder="Kaveri & Co." />
        <Field label="City" name="city" placeholder="Chennai" />
        <SelectField label="State" name="state_code" defaultValue="33">
          {INDIAN_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {state.code} · {state.name}
            </option>
          ))}
        </SelectField>
        <Field label="Firm GSTIN" name="gstin" placeholder="Optional, 15 characters" />
        <Field label="Mobile" name="phone" placeholder="98400 11122" />
        <Submit>Create the firm</Submit>
      </ActionForm>
    </main>
  );
}
