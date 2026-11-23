import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSession, resolveAuthDestination } from "@/lib/session";
import { retrySessionRecovery, signOut } from "@/server/actions/auth";

export default async function AuthRecoveryPage() {
  const session = await getSession();

  if (session.state !== "lookup_failed" && session.state !== "invalid_membership") {
    redirect(resolveAuthDestination(session));
  }

  const isMissingFirm = session.issue?.code === "missing_firm";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-12">
      <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
        <p className="text-xs tracking-[0.16em] text-destructive uppercase">
          {isMissingFirm ? "Workspace unavailable" : "Verification interrupted"}
        </p>
        <h1 className="mt-2 font-display text-3xl text-primary">
          {isMissingFirm ? "Your firm workspace could not be found." : "We could not verify your CRM access."}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {session.issue?.message ?? "Your sign-in session is active, but membership verification did not complete."}
        </p>
        {session.user?.email ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{session.user.email}</span>
          </p>
        ) : null}
        {session.issue?.code ? (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            Status: {session.issue.code}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <form action={retrySessionRecovery}>
            <Button type="submit">Retry check</Button>
          </form>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
