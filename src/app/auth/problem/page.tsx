import Link from "next/link";
import { signOut } from "@/server/actions/auth";

export default function SessionProblemPage() {
  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-16">
      <h1 className="font-display text-3xl">We could not open your workspace.</h1>
      <p>Your session, membership or firm could not be verified. No workspace data has been opened.</p>
      <p>Please retry, or sign out and sign in again. If this continues, ask the administrator to check the Supabase connection, migrations and membership permissions.</p>
      <Link className="underline" href="/auth/continue">Retry workspace check</Link>
      <form action={signOut}><button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">Sign out</button></form>
    </main>
  );
}
