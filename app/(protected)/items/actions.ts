"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppUser } from "../../../lib/auth/session";
import { createItem, updateItem, deleteItem, toggleFavorite, itemError } from "../../../lib/data/items";
import { upsertTag, deleteTag } from "../../../lib/data/tags";
import { parseItemForm } from "../../../lib/data/search";
import { parseCaptureForm } from "../../../lib/normalizers/parse-source";

export type ActionState = { error: string; saved?: string };

export async function saveItemAction(id: string | null, _state: ActionState, form: FormData): Promise<ActionState> {
  await requireAppUser();
  let saved: string;
  try {
    const input = { ...parseItemForm(form), capture: parseCaptureForm(form) };
    saved = id ? await updateItem(id, input) : await createItem(input);
  } catch (error) {
    return { error: error instanceof Error ? error.message : itemError };
  }
  revalidatePath("/items", "layout");
  return { error: "", saved };
}

export async function favoriteAction(id: string): Promise<ActionState> {
  await requireAppUser();
  try { await toggleFavorite(id); } catch { return { error: itemError }; }
  revalidatePath("/items", "layout");
  return { error: "" };
}

export async function deleteItemAction(id: string, _state: ActionState, form: FormData): Promise<ActionState> {
  await requireAppUser();
  if (form.get("confirm") !== "yes") return { error: "삭제 확인에 체크해 주세요." };
  try { await deleteItem(id); } catch { return { error: itemError }; }
  revalidatePath("/items", "layout");
  redirect("/items");
}

export async function addTagAction(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireAppUser();
  const name = form.get("name");
  if (typeof name !== "string") return { error: "태그 이름을 적어 주세요." };
  try { await upsertTag(name); } catch (error) { return { error: error instanceof Error ? error.message : itemError }; }
  revalidatePath("/items", "layout");
  return { error: "" };
}

export async function deleteTagAction(id: string, _state: ActionState, form: FormData): Promise<ActionState> {
  await requireAppUser();
  if (form.get("confirm") !== "yes") return { error: "삭제 확인에 체크해 주세요." };
  try { await deleteTag(id); } catch { return { error: itemError }; }
  revalidatePath("/items", "layout");
  return { error: "" };
}
