import "server-only";
import { createServerSupabaseClient } from "./supabase-server";
import { requireAppUser } from "../auth/session";
import { isItemId } from "./search";
import { readPublicResource } from "../extractors/public-resource";
import { validateThumbnailUrl } from "../extractors/url-policy";
import { matchesFileHeader } from "../storage/upload-policy";

export async function setItemCover(itemId: string, attachmentId: string | null) {
  await requireAppUser();
  if (!isItemId(itemId) || (attachmentId !== null && !isItemId(attachmentId))) throw new Error("사진을 확인해 주세요.");
  const client = await createServerSupabaseClient();
  const result = await client.rpc("set_item_cover", { p_item_id: itemId, p_attachment_id: attachmentId ?? undefined });
  if (result.error) throw new Error("대표 사진을 바꾸지 못했어요. 다시 시도해 주세요.");
}

export async function itemCover(itemId: string, userId: string, linkOnly = false) {
  if (!isItemId(itemId)) return null;
  const client = await createServerSupabaseClient();
  const item = await client.from("items").select("id").eq("id", itemId).eq("user_id", userId).maybeSingle();
  if (item.error || !item.data) return null;
  if (!linkOnly) {
    const cover = await client.from("attachments").select("storage_path,mime_type").eq("item_id", itemId).eq("user_id", userId).eq("is_cover", true).eq("status", "ready").maybeSingle();
    if (cover.error) throw new Error("Cover unavailable");
    if (cover.data) {
      const file = await client.storage.from("attachments").download(cover.data.storage_path);
      if (!file.error && file.data && file.data.size <= 5242880) {
        const bytes = new Uint8Array(await file.data.arrayBuffer());
        if (matchesFileHeader(bytes, cover.data.mime_type)) return { bytes, type: cover.data.mime_type };
      }
    }
  }
  const sources = await client.from("sources").select("url, extraction_requests(canonical_url,result)").eq("item_id", itemId).eq("user_id", userId).not("extraction_key", "is", null).order("created_at").limit(1);
  if (sources.error) throw new Error("Cover unavailable");
  for (const source of sources.data ?? []) {
    const extraction = source.extraction_requests;
    const result = extraction?.result;
    if (!extraction || extraction.canonical_url !== source.url || !result || typeof result !== "object" || Array.isArray(result)
      || !["success", "partial"].includes(String(result.status)) || typeof result.thumbnailUrl !== "string") continue;
    try {
      let destination = validateThumbnailUrl(result.thumbnailUrl).toString();
      const signal = AbortSignal.timeout(8000);
      for (let redirects = 0; redirects <= 3; redirects++) {
        const image = await readPublicResource(destination, signal, "image");
        if (image.redirect) { destination = validateThumbnailUrl(image.redirect).toString(); continue; }
        if (image.body && image.contentType && matchesFileHeader(image.body, image.contentType)) return { bytes: new Uint8Array(image.body), type: image.contentType };
        break;
      }
    } catch { /* Expired or unavailable platform images fall back to the default cover. */ }
  }
  return null;
}
