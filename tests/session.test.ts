import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), redirect: vi.fn(), getUser: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { getSession, requireStaff, requireClient } from "../src/lib/session";

function rows(values: Record<string, { data: unknown; error: unknown }>) {
  mocks.from.mockImplementation((name: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => values[name] ?? { data: null, error: null } }) }) }));
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: mocks.from });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
  rows({});
});
describe("session lookup and guards", () => {
  it("recognizes a genuinely unassigned user", async () => expect((await getSession()).issue).toBeNull());
  it("reports profile errors instead of absent membership", async () => {
    rows({ profiles: { data: null, error: { code: "42501" } } });
    expect((await getSession()).issue).toBe("profile_unavailable");
  });
  it("stops the dashboard/onboarding cycle for an invisible staff firm", async () => {
    rows({ profiles: { data: { id: "user", firm_id: "a" }, error: null } });
    await expect(requireStaff()).rejects.toThrow("redirect:/auth/problem");
  });
  it("stops the portal/dashboard cycle for an invisible client firm", async () => {
    rows({ client_users: { data: { id: "user", firm_id: "a" }, error: null } });
    await expect(requireClient()).rejects.toThrow("redirect:/auth/problem");
  });
  it("keeps unavailable auth distinct from signed out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503, code: "unexpected_failure" } });
    expect((await getSession()).issue).toBe("auth_unavailable");
  });
  it("sends invalid sessions to login", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    await expect(requireStaff()).rejects.toThrow("redirect:/login");
  });
  it("contains network failures without granting access", async () => {
    mocks.getUser.mockRejectedValue(new Error("network unavailable"));
    await expect(requireStaff()).rejects.toThrow("redirect:/auth/problem");
  });
  it("returns complete staff sessions", async () => {
    rows({ profiles: { data: { id: "user", firm_id: "a", role: "staff" }, error: null }, firms: { data: { id: "a" }, error: null } });
    expect((await requireStaff()).firm.id).toBe("a");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
