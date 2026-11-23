import { describe, expect, it } from "vitest";
import { sessionDestination, type RoutingSession } from "../src/lib/auth-routing";

const base: RoutingSession = { user: null, profile: null, client: null, firm: null };
describe("verified session routing", () => {
  it("keeps signed-out sessions at login", () => expect(sessionDestination(base)).toBe("/login"));
  it("sends a new authenticated user to onboarding", () => expect(sessionDestination({ ...base, user: {} })).toBe("/onboarding"));
  it("opens a complete staff membership", () => {
    expect(sessionDestination({ ...base, user: {}, profile: { firm_id: "a" }, firm: { id: "a" } })).toBe("/dashboard");
  });
  it("opens a complete client membership", () => {
    expect(sessionDestination({ ...base, user: {}, client: { firm_id: "a" }, firm: { id: "a" } })).toBe("/portal");
  });
  it.each(["profile", "client"] as const)("stops missing-firm %s sessions", (key) => {
    expect(sessionDestination({ ...base, user: {}, [key]: { firm_id: "a" } })).toBe("/auth/problem");
  });
  it.each(["profile", "client"] as const)("rejects mismatched %s firms", (key) => {
    expect(sessionDestination({ ...base, user: {}, [key]: { firm_id: "a" }, firm: { id: "b" } })).toBe("/auth/problem");
  });
  it("does not turn database errors into onboarding", () => {
    expect(sessionDestination({ ...base, user: {}, issue: "profile_unavailable" })).toBe("/auth/problem");
  });
});
