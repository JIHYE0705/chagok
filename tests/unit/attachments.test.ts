// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";
const { client, user } = vi.hoisted(() => ({
  user: vi.fn(), client: { rpc: vi.fn(), from: vi.fn(), storage: { from: vi.fn() } },
}));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/auth/session", () => ({ requireAppUser: user }));
vi.mock("../../lib/data/supabase-server", () => ({ createServerSupabaseClient: async () => client }));
import { createSignedUpload, deleteAttachment, deleteItemAttachments, finishAttachment } from "../../lib/data/attachments";
const id = "10000000-0000-0000-0000-000000000001";
const attachment = { id, user_id: id, storage_path: "owner/item/file.png", status: "pending", mime_type: "image/png", size_bytes: 10 };

beforeEach(() => { vi.resetAllMocks(); user.mockResolvedValue({ id }); });

test("requires authorization before reserving or signing a file", async () => {
  user.mockRejectedValue(new Error("denied"));
  await expect(createSignedUpload(id, id, { name: "file.png", type: "image/png", size: 10 })).rejects.toThrow("denied");
  expect(client.rpc).not.toHaveBeenCalled();
  expect(client.storage.from).not.toHaveBeenCalled();
});

test("a lost upload response reuses its reservation without signing another upload", async () => {
  client.rpc.mockResolvedValue({ data: attachment, error: null });
  const exists = vi.fn().mockResolvedValue({ data: true, error: null });
  const sign = vi.fn(); client.storage.from.mockReturnValue({ exists, createSignedUploadUrl: sign });
  expect(await createSignedUpload(id, id, { name: "file.png", type: "image/png", size: 10 })).toEqual({ id, ready: false, signedUrl: "" });
  expect(sign).not.toHaveBeenCalled();
});

test("Storage delete failure preserves the attachment metadata for retry", async () => {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: attachment, error: null }), delete: vi.fn() };
  client.from.mockReturnValue(query);
  client.storage.from.mockReturnValue({ remove: vi.fn().mockResolvedValue({ error: new Error("offline") }) });
  await expect(deleteAttachment(id)).rejects.toThrow("다시 시도");
  expect(query.delete).not.toHaveBeenCalled();
});

test("invalid file bytes cannot be marked ready", async () => {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: attachment, error: null }), update: vi.fn() };
  client.from.mockReturnValue(query);
  client.storage.from.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.example/file" }, error: null }) });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<script>invalid</script>")));
  try { await expect(finishAttachment(id)).rejects.toThrow("파일 내용과 형식"); }
  finally { vi.unstubAllGlobals(); }
  expect(query.update).not.toHaveBeenCalled();
});

test("item cleanup failure warns that deletion may be partial", async () => {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: null, error: new Error("offline") }) };
  client.from.mockReturnValue(query);
  await expect(deleteItemAttachments(id)).rejects.toThrow("항목은 유지되지만 일부 파일");
});


test("Storage exists returns a not-found error alongside false for a new upload", async () => {
  client.rpc.mockResolvedValue({ data: attachment, error: null });
  const sign = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.example/upload" }, error: null });
  client.storage.from.mockReturnValue({ exists: vi.fn().mockResolvedValue({ data: false, error: { status: 404 } }), createSignedUploadUrl: sign });
  expect((await createSignedUpload(id, id, { name: "file.png", type: "image/png", size: 10 })).signedUrl).toBe("https://storage.example/upload");
  expect(sign).toHaveBeenCalledTimes(1);
});
