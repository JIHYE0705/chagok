// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClient, getUser } = vi.hoisted(() => ({ createServerClient: vi.fn(), getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
import { proxy } from "../../proxy";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fixture");
  createServerClient.mockReturnValue({ auth: { getUser } });
});

test("refresh cookies reach both server rendering and the browser with cache protection", async () => {
  const request = new NextRequest("http://localhost:3000/items");
  getUser.mockImplementation(async () => {
    const { cookies } = createServerClient.mock.calls[0][2];
    cookies.setAll([{ name: "session", value: "renewed", options: { path: "/", httpOnly: true } }], { Pragma: "no-cache" });
    return { data: { user: { id: "owner" } }, error: null };
  });
  const response = await proxy(request);
  expect(request.cookies.get("session")?.value).toBe("renewed");
  expect(response.cookies.get("session")?.value).toBe("renewed");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Pragma")).toBe("no-cache");
});

test("public login remains available before Supabase configuration", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  expect((await proxy(new NextRequest("http://localhost:3000/login"))).status).toBe(200);
  expect(createServerClient).not.toHaveBeenCalled();
});
