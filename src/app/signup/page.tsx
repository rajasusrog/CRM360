import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { getSession, resolveAuthDestination, safeNextPath } from "@/lib/session";
import { getConfiguredAppOrigin, isDemoModeEnabled } from "@/lib/supabase/public-env";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();

  if (
    session.user ||
    session.state === "invalid_membership" ||
    (session.state === "lookup_failed" && session.issue?.code !== "auth_lookup_failed")
  ) {
    redirect(
      resolveAuthDestination(session, {
        requestedNext: params.next,
        allowedOrigin: getConfiguredAppOrigin(),
      }),
    );
  }

  return (
    <AuthPanel
      mode="signup"
      nextPath={safeNextPath(params.next, getConfiguredAppOrigin()) ?? ""}
      initialError={params.error ?? (session.issue?.code === "auth_lookup_failed" ? session.issue.message : null)}
      demoEnabled={isDemoModeEnabled()}
      appOrigin={getConfiguredAppOrigin() ?? ""}
    />
  );
}
