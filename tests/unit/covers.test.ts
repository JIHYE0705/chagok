// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } }, user: vi.fn(), read: vi.fn(), current: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/data/supabase-server", () => ({ createServerSupabaseClient: async () => mocks.client }));
vi.mock("../../lib/auth/session", () => ({ requireAppUser: mocks.user, getCurrentUser: mocks.current }));
vi.mock("../../lib/extractors/public-resource", () => ({ readPublicResource: mocks.read }));
import { itemCover, setItemCover } from "../../lib/data/covers";
import { GET } from "../../app/api/items/[id]/cover/route";
const id = "10000000-0000-0000-0000-000000000001";
const url = "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg";
function query(data: unknown) {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data }), maybeSingle: vi.fn().mockResolvedValue({ data }) };
}
function source(thumbnailUrl = url) { return [{ url: "source", extraction_requests: { canonical_url: "source", result: { status: "partial", thumbnailUrl } } }]; }
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id }); });
test("cover changes authenticate, validate identifiers and surface database failure", async () => {
  await expect(setItemCover(id, "bad")).rejects.toThrow("확인");
  expect(mocks.client.rpc).not.toHaveBeenCalled();
  mocks.client.rpc.mockResolvedValue({ error: null });
  await setItemCover(id, null);
  expect(mocks.client.rpc).toHaveBeenCalledWith("set_item_cover", { p_item_id: id, p_attachment_id: undefined });
  mocks.client.rpc.mockResolvedValue({ error: true });
  await expect(setItemCover(id, id)).rejects.toThrow("바꾸지 못했어요");
  mocks.user.mockRejectedValue(new Error("denied"));
  await expect(setItemCover(id, null)).rejects.toThrow("denied");
});
test("a missing or inaccessible item never reaches file download or external network", async () => {
  mocks.client.from.mockReturnValue(query(null));
  expect(await itemCover(id, id)).toBeNull();
  expect(mocks.client.storage.from).not.toHaveBeenCalled();
  expect(mocks.read).not.toHaveBeenCalled();
});
test("selected private photo has priority and is read with the current client", async () => {
  mocks.client.from.mockReturnValueOnce(query({ id })).mockReturnValueOnce(query({ storage_path: "private", mime_type: "image/jpeg" }));
  mocks.client.storage.from.mockReturnValue({ download: vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array([255,216,255])]) }) });
  expect(await itemCover(id, id)).toEqual({ bytes: new Uint8Array([255,216,255]), type: "image/jpeg" });
  expect(mocks.read).not.toHaveBeenCalled();
});
test("missing private photo falls back to bounded source thumbnail", async () => {
  mocks.client.from.mockReturnValueOnce(query({ id })).mockReturnValueOnce(query({ storage_path: "missing", mime_type: "image/jpeg" })).mockReturnValueOnce(query(source()));
  mocks.client.storage.from.mockReturnValue({ download: vi.fn().mockResolvedValue({ error: true }) });
  mocks.read.mockResolvedValue({ body: Buffer.from([255,216,255]), contentType: "image/jpeg" });
  expect((await itemCover(id, id))?.type).toBe("image/jpeg");
  expect(mocks.read).toHaveBeenCalledWith(url, expect.any(AbortSignal), "image");
});
test("source URL changes and failed extraction cannot retain stale thumbnails", async () => {
  for (const extraction of [ { canonical_url: "old source", result: { status: "partial", thumbnailUrl: url } }, { canonical_url: "source", result: { status: "failed", thumbnailUrl: url } } ]) {
    mocks.client.from.mockReturnValueOnce(query({ id })).mockReturnValueOnce(query(null)).mockReturnValueOnce(query([{ url: "source", extraction_requests: extraction }]));
    expect(await itemCover(id, id)).toBeNull();
  }
  expect(mocks.read).not.toHaveBeenCalled();
});
test("redirect targets are revalidated, bad image bytes fail closed, and redirects are bounded", async () => {
  const prepare = () => mocks.client.from.mockReturnValueOnce(query({ id })).mockReturnValueOnce(query(null)).mockReturnValueOnce(query(source()));
  prepare(); mocks.read.mockResolvedValueOnce({ redirect: "https://127.0.0.1/private.png" });
  expect(await itemCover(id, id)).toBeNull();
  expect(mocks.read).toHaveBeenCalledTimes(1);
  prepare(); mocks.read.mockResolvedValueOnce({ body: Buffer.from("<script>bad</script>"), contentType: "image/jpeg" });
  expect(await itemCover(id, id)).toBeNull();
  mocks.read.mockClear(); prepare(); mocks.read.mockResolvedValue({ redirect: url });
  expect(await itemCover(id, id)).toBeNull();
  expect(mocks.read).toHaveBeenCalledTimes(4);
});
test("image endpoint denies anonymous and revoked sessions before loading an image", async () => {
  const context = { params: Promise.resolve({ id }) };
  mocks.current.mockResolvedValue(null);
  const anonymous = await GET(new Request("https://app.test"), context);
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("cache-control")).toBe("private, no-store");
  mocks.current.mockResolvedValue({ id }); mocks.client.rpc.mockResolvedValue({ data: false });
  expect((await GET(new Request("https://app.test"), context)).status).toBe(403);
  expect(mocks.client.from).not.toHaveBeenCalled();
});


test("browser decoding fallback skips the selected attachment and only reads source metadata", async () => {
  mocks.client.from.mockReturnValueOnce(query({ id })).mockReturnValueOnce(query(source()));
  mocks.read.mockResolvedValue({ body: Buffer.from([255,216,255]), contentType: "image/jpeg" });
  expect((await itemCover(id, id, true))?.type).toBe("image/jpeg");
  expect(mocks.client.storage.from).not.toHaveBeenCalled();
  expect(mocks.client.from.mock.calls.map(([table]) => table)).toEqual(["items", "sources"]);
});
