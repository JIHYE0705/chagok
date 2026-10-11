"use server";

import { revalidatePath } from "next/cache";
import { createSignedUpload, finishAttachment, attachmentReadUrl, deleteAttachment } from "../../../lib/data/attachments";

export async function signAttachmentAction(itemId: string, key: string, file: { name: string; type: string; size: number }) {
  try { return { upload: await createSignedUpload(itemId, key, file), error: "" }; }
  catch (error) { return { upload: null, error: error instanceof Error ? error.message : "첨부를 준비하지 못했어요." }; }
}

export async function finishAttachmentAction(id: string) {
  try { await finishAttachment(id); }
  catch (error) { return { error: error instanceof Error ? error.message : "첨부를 완료하지 못했어요." }; }
  revalidatePath("/items", "layout");
  return { error: "" };
}

export async function readAttachmentAction(id: string) {
  try { return { url: await attachmentReadUrl(id), error: "" }; }
  catch { return { url: "", error: "첨부를 열지 못했어요. 다시 시도해 주세요." }; }
}

export async function deleteAttachmentAction(id: string) {
  try { await deleteAttachment(id); }
  catch (error) { return { error: error instanceof Error ? error.message : "첨부를 삭제하지 못했어요." }; }
  revalidatePath("/items", "layout");
  return { error: "" };
}
