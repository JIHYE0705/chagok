import "server-only";
import { requireAppUser } from "../auth/session";
import { createServerSupabaseClient } from "./supabase-server";
import { isItemId, validateItem, type ItemInput, type Filters } from "./search";

const selection = "*, item_contents(body), item_tags(tags(id, name)), recipe_details(*, ingredients(*), recipe_steps(*))" as const;
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

async function saveItem(id: string | null, input: ItemInput) {
  await requireAppUser();
  const validated = validateItem(input);
  if (id !== null && !isItemId(id)) throw new Error("항목을 찾을 수 없어요.");
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("save_item", { p_item_id: id ?? undefined, p_title: validated.title, p_summary: validated.summary, p_body: validated.body, p_notes: validated.notes, p_tags: validated.tags });
  if (error || !data) throw new Error(itemError);
  return data;
}
export async function createItem(input: ItemInput) { return saveItem(null, input); }
export async function updateItem(id: string, input: ItemInput) { return saveItem(id, input); }

export async function deleteItem(id: string) {
  const user = await requireAppUser();
  if (!isItemId(id)) throw new Error("항목을 찾을 수 없어요.");
  const client = await createServerSupabaseClient();
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
