// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), from: vi.fn(), extract: vi.fn() }));
vi.mock("../../lib/auth/session", () => ({ getCurrentUser: mocks.user }));
vi.mock("../../lib/data/supabase-server", () => ({ createServerSupabaseClient: async () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("../../lib/extractors/metadata", () => ({ extractMetadata: mocks.extract }));
import { POST } from "../../app/api/extract/route";
const key = "10000000-0000-0000-0000-000000000001";
const canonicalUrl = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const result = { status: "partial", canonicalUrl, title: "제목", description: "", author: "" };
const request = (body = { url: canonicalUrl, key }, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/extract", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
function responses(...values: unknown[]) {
  mocks.from.mockImplementation(() => {
    const value = values.shift();
    const chain: Record<string, unknown> = {};
    for (const method of ["insert", "select", "eq", "is", "lt", "update", "single", "limit"]) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(value).then(resolve);
    return chain;
  });
}
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_URL", "http://localhost:3000"); mocks.user.mockResolvedValue({ id: "owner" }); mocks.rpc.mockResolvedValue({ data: true, error: null }); });
test("requires same-origin authenticated invited access before reading URLs or fetching", async () => {
  expect((await POST(request(undefined, "https://evil.test"))).status).toBe(403);
  expect(mocks.user).not.toHaveBeenCalled();
  mocks.user.mockResolvedValue(null); expect((await POST(request())).status).toBe(401);
  mocks.user.mockResolvedValue({ id: "owner" }); mocks.rpc.mockResolvedValue({ data: false, error: null });
  expect((await POST(request())).status).toBe(403);
  expect(mocks.extract).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
});
test("invalid and oversized request bodies never reach outbound fetching", async () => {
  expect((await POST(request({ url: "https://127.0.0.1", key }))).status).toBe(400);
  expect((await POST(request({ url: "x".repeat(9000), key }))).status).toBe(400);
  expect(mocks.extract).not.toHaveBeenCalled();
});
test("new extraction persists its result and returns only the owner's duplicate link", async () => {
  responses({ error: null }, { data: [{ idempotency_key: key }], error: null }, { data: [{ item_id: key }], error: null });
  mocks.extract.mockResolvedValue(result);
  const response = await POST(request());
  expect(await response.json()).toEqual({ ...result, duplicateId: key });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.extract).toHaveBeenCalledTimes(1);
});
test("same key and canonical URL reuse the cached result without another fetch", async () => {
  responses({ error: { code: "23505" } }, { data: { canonical_url: canonicalUrl, result }, error: null }, { data: [], error: null });
  expect(await (await POST(request({ url: "https://youtu.be/jNQXAC9IVRw?si=tracking", key }))).json()).toEqual({ ...result, duplicateId: null });
  expect(mocks.extract).not.toHaveBeenCalled();
});
test("in-flight duplicate waits; reusing a key for a different URL is rejected", async () => {
  responses({ error: { code: "23505" } }, { data: { canonical_url: canonicalUrl, result: null, lease_id: key }, error: null }, { data: [], error: null });
  expect((await POST(request())).status).toBe(202);
  responses({ error: { code: "23505" } }, { data: { canonical_url: "different", result }, error: null });
  expect((await POST(request())).status).toBe(409);
  expect(mocks.extract).not.toHaveBeenCalled();
});
test("a stale lease can be reclaimed while DB errors never report success", async () => {
  responses({ error: { code: "23505" } }, { data: { canonical_url: canonicalUrl, result: null, lease_id: key }, error: null }, { data: [{ idempotency_key: key }], error: null }, { data: [{ idempotency_key: key }], error: null }, { data: [], error: null });
  mocks.extract.mockResolvedValue(result);
  expect((await POST(request())).status).toBe(200);
  responses({ error: { code: "private_error" } });
  expect((await POST(request())).status).toBe(503);
});
