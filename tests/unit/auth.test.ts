// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

const { client } = vi.hoisted(() => ({
  client: {
    auth: { getUser: vi.fn(), signInWithOAuth: vi.fn(), signOut: vi.fn(), exchangeCodeForSession: vi.fn() },
    rpc: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/data/supabase-server", () => ({ createServerSupabaseClient: async () => client }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));

import { getCurrentUser, requireAppUser } from "../../lib/auth/session";
import { GET } from "../../app/auth/callback/route";
import { signIn, signOut } from "../../app/auth/actions";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fixture");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  client.auth.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  client.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  client.auth.signOut.mockResolvedValue({ error: null });
  client.rpc.mockResolvedValue({ data: true, error: null });
});

test("protects a route only after Auth verification and DB access approval", async () => {
  expect(await requireAppUser()).toEqual({ id: "owner" });
  expect(client.auth.getUser).toHaveBeenCalled();
  expect(client.rpc).toHaveBeenCalledWith("has_app_access");
});

test("signed-out and invalid sessions never query app data", async () => {
  client.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
  expect(await getCurrentUser()).toBeNull();
  await expect(requireAppUser()).rejects.toThrow("redirect:/login?error=session");
  expect(client.rpc).not.toHaveBeenCalled();
});

test.each([
  [false, null, "denied"],
  [null, { message: "unavailable" }, "unavailable"],
])("fails closed when access is %s", async (data, error, reason) => {
  client.rpc.mockResolvedValue({ data, error });
  await expect(requireAppUser()).rejects.toThrow(`redirect:/login?error=${reason}`);
});

test("missing configuration gives an actionable login state", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  await expect(requireAppUser()).rejects.toThrow("redirect:/login?error=config");
  expect(client.auth.getUser).not.toHaveBeenCalled();
});

test("OAuth uses the configured callback origin, not a caller redirect", async () => {
  client.auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/fixture" }, error: null });
  await expect(signIn()).rejects.toThrow("redirect:https://accounts.google.com/fixture");
  expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: "google", options: { redirectTo: "http://localhost:3000/auth/callback", skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
});

test("OAuth setup and provider errors have explicit states", async () => {
  vi.stubEnv("APP_URL", "");
  await expect(signIn()).rejects.toThrow("redirect:/login?error=config");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  client.auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: new Error("offline") });
  await expect(signIn()).rejects.toThrow("redirect:/login?error=unavailable");
});

test("callback exchanges PKCE before activation and ignores external next URLs", async () => {
  await expect(GET(new Request("http://localhost:3000/auth/callback?code=fixture&next=https://evil.test")))
    .rejects.toThrow("redirect:/items");
  expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith("fixture");
  expect(client.rpc).toHaveBeenCalledWith("authorize_current_user");
});

test("missing or failed PKCE exchange never activates a profile", async () => {
  await expect(GET(new Request("http://localhost:3000/auth/callback?error=access_denied")))
    .rejects.toThrow("redirect:/login?error=callback");
  client.auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });
  await expect(GET(new Request("http://localhost:3000/auth/callback?code=bad")))
    .rejects.toThrow("redirect:/login?error=callback");
  expect(client.rpc).not.toHaveBeenCalled();
});

test.each([
  [false, null, "denied"],
  [null, { message: "offline" }, "unavailable"],
])("callback clears local session after access failure", async (data, error, reason) => {
  client.rpc.mockResolvedValue({ data, error });
  await expect(GET(new Request("http://localhost:3000/auth/callback?code=fixture")))
    .rejects.toThrow(`redirect:/login?error=${reason}`);
  expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});

test("logout reports failures instead of claiming success", async () => {
  client.auth.signOut.mockResolvedValue({ error: new Error("offline") });
  await expect(signOut()).rejects.toThrow("redirect:/login?error=signout");
  client.auth.signOut.mockResolvedValue({ error: null });
  await expect(signOut()).rejects.toThrow("redirect:/login");
});
