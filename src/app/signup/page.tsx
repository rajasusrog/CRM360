import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { getSession, resolveAuthDestination, safeNextPath } from "@/lib/session";
import { getConfiguredAppOrigin, isDemoModeEnabled, isLocalOrPreviewHost } from "@/lib/supabase/public-env";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const configuredOrigin = getConfiguredAppOrigin();

  if (configuredOrigin) {
    const reqHeaders = await headers();
    const rawHost = reqHeaders.get("x-forwarded-host") || reqHeaders.get("host") || "";
    const host = rawHost.split(",")[0]?.trim() ?? "";
    const proto = (reqHeaders.get("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
    const hostname = host.split(":")[0] ?? "";
    if (host && !isLocalOrPreviewHost(hostname)) {
      let requestOrigin = "";
      try {
        requestOrigin = new URL(`${proto}://${host}`).origin;
      } catch {
        requestOrigin = "";
      }
      if (requestOrigin && requestOrigin !== configuredOrigin) {
        const target = new URL("/signup", configuredOrigin);
        const safeNext = safeNextPath(params.next, configuredOrigin);
        if (safeNext) target.searchParams.set("next", safeNext);
        if (params.error) target.searchParams.set("error", params.error);
        redirect(target.toString());
      }
    }
  }

  const session = await getSession();

  if (
    session.user ||
    session.state === "invalid_membership" ||
    (session.state === "lookup_failed" && session.issue?.code !== "auth_lookup_failed")
  ) {
    redirect(
      resolveAuthDestination(session, {
        requestedNext: params.next,
        allowedOrigin: configuredOrigin,
      }),
    );
  }

  return (
    <AuthPanel
      mode="signup"
      nextPath={safeNextPath(params.next, configuredOrigin) ?? ""}
      initialError={params.error ?? (session.issue?.code === "auth_lookup_failed" ? session.issue.message : null)}
      demoEnabled={isDemoModeEnabled()}
      appOrigin={configuredOrigin ?? ""}
    />
  );
}
