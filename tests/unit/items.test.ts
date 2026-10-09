// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest";

const { client, user } = vi.hoisted(() => ({ client: { rpc: vi.fn(), from: vi.fn() }, user: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/auth/session", () => ({ requireAppUser: user }));
vi.mock("../../lib/data/supabase-server", () => ({ createServerSupabaseClient: async () => client }));
import { createItem, updateItem, toggleFavorite, getItem } from "../../lib/data/items";
import { parseItemForm, parseFilters } from "../../lib/data/search";

beforeEach(() => { vi.resetAllMocks(); user.mockResolvedValue({ id: "owner" }); });

test("normalizes tag whitespace and case duplicates without inventing body text", () => {
  const form = new FormData();
  form.set("title", "  고구마  "); form.set("body", "분량 미기재"); form.set("tags", " 간식, 간식, SWEET, sweet ");
  expect(parseItemForm(form)).toEqual({ title: "고구마", summary: "", body: "분량 미기재", notes: "", tags: ["간식", "SWEET"] });
});

test("rejects empty titles, long tags and oversized content at the server boundary", () => {
  const form = new FormData();
  expect(() => parseItemForm(form)).toThrow("제목");
  form.set("title", "제목"); form.set("tags", "가".repeat(51));
  expect(() => parseItemForm(form)).toThrow("태그");
  form.set("tags", ""); form.set("body", "가".repeat(50001));
  expect(() => parseItemForm(form)).toThrow("본문");
});

test("query arrays and malformed filters are safe, literal search is preserved", () => {
  expect(parseFilters({ q: ["ignored"], tag: "bad", page: "-1", favorite: "false" })).toEqual({ q: "", tag: "", page: 1, favorite: false });
  expect(parseFilters({ q: " %_,() ", page: "2", favorite: "1" })).toEqual({ q: "%_,()", tag: "", page: 2, favorite: true });
});

test("create and update authenticate before using one atomic RPC", async () => {
  const input = { title: "제목", body: "본문", summary: "", notes: "", tags: ["간식"] };
  client.rpc.mockResolvedValue({ data: "id", error: null });
  expect(await createItem(input)).toBe("id");
  expect(client.rpc).toHaveBeenCalledWith("save_item", { p_item_id: undefined, p_title: "제목", p_summary: "", p_body: "본문", p_notes: "", p_tags: ["간식"] });
  const id = "10000000-0000-0000-0000-000000000001";
  await updateItem(id, input);
  expect(client.rpc).toHaveBeenLastCalledWith("save_item", expect.objectContaining({ p_item_id: id }));
  expect(user).toHaveBeenCalledTimes(2);
});

test("save and favorite errors never claim success", async () => {
  client.rpc.mockResolvedValue({ data: null, error: { message: "private database error" } });
  await expect(toggleFavorite("10000000-0000-0000-0000-000000000001")).rejects.toThrow("처리하지 못했어요");
  user.mockRejectedValue(new Error("signed out"));
  await expect(createItem({ title: "제목", summary: "", body: "", notes: "", tags: [] })).rejects.toThrow("signed out");
  expect(client.rpc).toHaveBeenCalledTimes(1);
});

test("malformed item IDs return missing without querying private rows", async () => {
  expect(await getItem("not-a-uuid")).toBeNull();
  expect(client.from).not.toHaveBeenCalled();
});
