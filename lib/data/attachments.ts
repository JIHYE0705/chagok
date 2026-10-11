import "server-only";
import { requireAppUser } from "../auth/session";
import { createServerSupabaseClient } from "./supabase-server";
import { isItemId } from "./search";
import { validateUpload, matchesFileHeader } from "../storage/upload-policy";

const errorMessage = "첨부를 처리하지 못했어요. 파일은 그대로 두고 다시 시도해 주세요.";

export async function listAttachments(itemId: string) {
  const user = await requireAppUser();
  if (!isItemId(itemId)) throw new Error(errorMessage);
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("attachments").select("*").eq("user_id", user.id).eq("item_id", itemId).order("created_at");
  if (error) throw new Error(errorMessage);
  return data ?? [];
}

async function ownedAttachment(id: string) {
  const user = await requireAppUser();
  if (!isItemId(id)) throw new Error(errorMessage);
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("attachments").select("*").eq("user_id", user.id).eq("id", id).single();
  if (error || !data) throw new Error(errorMessage);
  return { attachment: data, client };
}

export async function createSignedUpload(itemId: string, key: string, file: { name: string; type: string; size: number }) {
  await requireAppUser();
  if (!isItemId(itemId) || !isItemId(key)) throw new Error(errorMessage);
  validateUpload(file);
  const client = await createServerSupabaseClient();
  const reserved = await client.rpc("reserve_attachment", { p_item_id: itemId, p_key: key, p_name: file.name, p_mime: file.type, p_size: file.size });
  if (reserved.error || !reserved.data) throw new Error("첨부를 준비하지 못했어요. 항목당 최대 10개이며 같은 요청에는 같은 파일을 사용해 주세요.");
  if (reserved.data.status === "ready") return { id: reserved.data.id, ready: true, signedUrl: "" };
  // A lost upload response must be finalized without uploading the same bytes again.
  const exists = await client.storage.from("attachments").exists(reserved.data.storage_path);
  if (exists.data) return { id: reserved.data.id, ready: false, signedUrl: "" };
  const signed = await client.storage.from("attachments").createSignedUploadUrl(reserved.data.storage_path, { upsert: false });
  if (signed.error || !signed.data) throw new Error(errorMessage);
  return { id: reserved.data.id, ready: false, signedUrl: signed.data.signedUrl };
}

export async function finishAttachment(id: string) {
  const { attachment, client } = await ownedAttachment(id);
  if (attachment.status === "ready") return;
  const signed = await client.storage.from("attachments").createSignedUrl(attachment.storage_path, 60);
  if (signed.error || !signed.data) throw new Error(errorMessage);
  const response = await fetch(signed.data.signedUrl, { headers: { Range: "bytes=0-15" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  const reader = response.body?.getReader();
  if (!reader) throw new Error(errorMessage);
  const bytes: number[] = [];
  try {
    while (bytes.length < 16) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes.push(...chunk.value.slice(0, 16 - bytes.length));
    }
  } finally { await reader.cancel(); }
  if (!response.ok || !matchesFileHeader(new Uint8Array(bytes), attachment.mime_type)) {
    throw new Error("파일 내용과 형식이 달라요. 첨부를 삭제한 뒤 올바른 파일을 선택해 주세요.");
  }
  const saved = await client.from("attachments").update({ status: "ready" }).eq("id", id).eq("user_id", attachment.user_id).select("id");
  if (saved.error || !saved.data?.length) throw new Error(errorMessage);
}

export async function attachmentReadUrl(id: string) {
  const { attachment, client } = await ownedAttachment(id);
  if (attachment.status !== "ready") throw new Error("업로드를 먼저 완료해 주세요.");
  const signed = await client.storage.from("attachments").createSignedUrl(attachment.storage_path, 60);
  if (signed.error || !signed.data) throw new Error(errorMessage);
  return signed.data.signedUrl;
}

export async function deleteAttachment(id: string) {
  const { attachment, client } = await ownedAttachment(id);
  const removed = await client.storage.from("attachments").remove([attachment.storage_path]);
  if (removed.error) throw new Error(errorMessage);
  const deleted = await client.from("attachments").delete().eq("id", id).eq("user_id", attachment.user_id).select("id");
  if (deleted.error || !deleted.data?.length) throw new Error(errorMessage);
}

export async function deleteItemAttachments(itemId: string) {
  try {
    for (const attachment of await listAttachments(itemId)) await deleteAttachment(attachment.id);
  } catch {
    throw new Error("첨부 정리를 완료하지 못했어요. 항목은 유지되지만 일부 파일은 삭제됐을 수 있어요. 다시 삭제해 주세요.");
  }
}
