import "server-only";
import { randomUUID } from "node:crypto";
import { deleteItemAttachments } from "./attachments";
import { requireAppUser } from "../auth/session";
import { createServerSupabaseClient } from "./supabase-server";
import { isItemId, validateItem, type ItemInput, type Filters } from "./search";
import { normalizeItem } from "../normalizers/normalize-item";

const selection = "*, item_contents(body, raw_text), sources(*, source_evidence(*)), item_tags(tags(id, name)), recipe_details(*, ingredients(*), recipe_steps(*))" as const;
export const itemError = "처리하지 못했어요. 입력은 그대로 두고 잠시 후 다시 시도해 주세요.";

export async function listItems(filters: Filters) {
  const user = await requireAppUser();
  const client = await createServerSupabaseClient();
  const result = await client.rpc("search_items", { p_query: filters.q, p_tag_id: filters.tag || undefined, p_favorite: filters.favorite, p_page: filters.page });
  if (result.error) throw new Error(itemError);
  const rows = result.data ?? [];
  const ids = rows.slice(0, 24).map((row) => row.id);
  if (!ids.length) return { items: [], hasMore: false };
  const { data, error } = await client.from("items").select("*, item_tags(tags(id, name))").eq("user_id", user.id).in("id", ids).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (error) throw new Error(itemError);
  return { items: data ?? [], hasMore: rows.length > 24 };
}

export async function getItem(id: string) {
  const user = await requireAppUser();
  if (!isItemId(id)) return null;
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("items").select(selection).eq("user_id", user.id).eq("id", id).maybeSingle();
  if (error) throw new Error(itemError);
  return data;
}
export type ItemDetail = NonNullable<Awaited<ReturnType<typeof getItem>>>;

async function saveItem(id: string | null, input: ItemInput, requestKey: string) {
  await requireAppUser();
  const validated = validateItem(input);
  if (id !== null && !isItemId(id)) throw new Error("항목을 찾을 수 없어요.");
  if (!isItemId(requestKey)) throw new Error("저장 요청을 확인해 주세요.");
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("save_item_once", { p_key: requestKey, p_item_id: id ?? undefined, p_input: {
    ...validated, ...(validated.capture ? { capture: { ...validated.capture, evidence: normalizeItem(validated.capture.rawText, validated.capture.kind).evidence } } : {}),
  } });
  if (error?.code === "22023" && error.message === "Save key conflict") throw new Error("저장 요청과 내용이 달라요. 보관함에서 먼저 저장 결과를 확인해 주세요.");
  if (error || !data) throw new Error(itemError);
  return data;
}
export async function createItem(input: ItemInput, requestKey: string = randomUUID()) { return saveItem(null, input, requestKey); }
export async function updateItem(id: string, input: ItemInput, requestKey: string = randomUUID()) { return saveItem(id, input, requestKey); }

export async function deleteItem(id: string) {
  const user = await requireAppUser();
  if (!isItemId(id)) throw new Error("항목을 찾을 수 없어요.");
  const client = await createServerSupabaseClient();
  await deleteItemAttachments(id);
  const { data, error } = await client.from("items").delete().eq("user_id", user.id).eq("id", id).select("id");
  if (error || !data?.length) throw new Error(itemError);
}

export async function toggleFavorite(id: string) {
  await requireAppUser();
  if (!isItemId(id)) throw new Error("항목을 찾을 수 없어요.");
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("toggle_item_favorite", { p_item_id: id });
  if (error || data === null) throw new Error(itemError);
  return data;
}
