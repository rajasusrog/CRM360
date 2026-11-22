import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/action-form";
import { getSession } from "@/lib/session";
import { acceptPortalInvite } from "@/server/actions/auth";

export default async function PortalJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();
  if (!session.user) redirect(`/login?next=/portal/join/${token}`);
  if (session.client) redirect("/portal");

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <h1 className="font-display text-4xl">Client portal</h1>
      <p className="mt-2 text-sm text-muted-foreground">Signed in as {session.user.email}.</p>
      <ActionForm action={acceptPortalInvite.bind(null, token)} className="mt-6">
        <Submit>Open my file</Submit>
      </ActionForm>
    </main>
  );
}
