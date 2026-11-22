import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/action-form";
import { getSession } from "@/lib/session";
import { acceptInvite } from "@/server/actions/auth";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();
  if (!session.user) redirect(`/login?next=/join/${token}`);
  if (session.profile) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-lg px-5 py-16">
      <h1 className="font-display text-4xl">Join the firm</h1>
      <p className="mt-2 text-sm text-muted-foreground">You are signed in as {session.user.email}. The invite only works for that address.</p>
      <ActionForm action={acceptInvite.bind(null, token)} className="mt-6">
        <Submit>Accept invite</Submit>
      </ActionForm>
      <p className="mt-4 text-sm"><Link href="/login">Use a different email</Link></p>
    </main>
  );
}
