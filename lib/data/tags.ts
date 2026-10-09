import "server-only";
import { requireAppUser } from "../auth/session";
import { createServerSupabaseClient } from "./supabase-server";
import { itemError } from "./items";
import { isItemId } from "./search";

export async function listTags() {
  const user = await requireAppUser();
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("tags").select("id,name").eq("user_id", user.id).order("name");
  if (error) throw new Error(itemError);
  return data ?? [];
}

export async function upsertTag(name: string) {
  await requireAppUser();
  name = name.trim();
  if (!name || [...name].length > 50) throw new Error("태그는 1~50자로 적어 주세요.");
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("upsert_tag", { p_name: name });
  if (error) throw new Error(itemError);
  return data;
}

export async function deleteTag(id: string) {
  const user = await requireAppUser();
  if (!isItemId(id)) throw new Error("태그를 찾을 수 없어요.");
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("tags").delete().eq("user_id", user.id).eq("id", id).select("id");
  if (error || !data?.length) throw new Error(itemError);
}
