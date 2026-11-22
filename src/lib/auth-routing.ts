/** Resolve one verified server session. Incomplete membership must never loop. */
export type RoutingSession = {
  user: unknown;
  profile: { firm_id: string } | null;
  client: { firm_id: string } | null;
  firm: { id: string } | null;
  issue?: string | null;
};

export function sessionDestination(session: RoutingSession) {
  if (session.issue) return "/auth/problem";
  if (!session.user) return "/login";
  if (session.profile) {
    return session.firm?.id === session.profile.firm_id ? "/dashboard" : "/auth/problem";
  }
  if (session.client) {
    return session.firm?.id === session.client.firm_id ? "/portal" : "/auth/problem";
  }
  return "/onboarding";
}
