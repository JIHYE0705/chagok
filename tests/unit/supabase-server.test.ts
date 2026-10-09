import { beforeEach, expect, test, vi } from "vitest";

const { createServerClient, cookieStore } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  cookieStore: { getAll: vi.fn(), set: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

import { createServerSupabaseClient } from "../../lib/data/supabase-server";

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

test("fails when configuration is missing", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  await expect(createServerSupabaseClient()).rejects.toThrow("Supabase URL and publishable key are required.");
  expect(createServerClient).not.toHaveBeenCalled();
});

test("uses the publishable key and the current request's cookies", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "must-not-be-used");
  cookieStore.getAll.mockReturnValue([{ name: "session", value: "fixture" }]);
  createServerClient.mockReturnValue({ from: "client" });
  expect(await createServerSupabaseClient()).toEqual({ from: "client" });
  const [url, key, options] = createServerClient.mock.calls[0];
  expect(url).toBe("https://example.supabase.co");
  expect(key).toBe("sb_publishable_test");
  expect(options.cookies.getAll()).toEqual([{ name: "session", value: "fixture" }]);
  options.cookies.setAll([{ name: "session", value: "updated", options: { httpOnly: true } }]);
  expect(cookieStore.set).toHaveBeenCalledWith("session", "updated", { httpOnly: true });
  cookieStore.set.mockImplementation(() => { throw new Error("read-only Server Component"); });
  expect(() => options.cookies.setAll([{ name: "session", value: "updated", options: {} }])).not.toThrow();
});
