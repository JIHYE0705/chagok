import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../../../lib/auth/session";
import { createServerSupabaseClient } from "../../../lib/data/supabase-server";
import { isItemId } from "../../../lib/data/search";
import { extractMetadata } from "../../../lib/extractors/metadata";
import { validateSourceUrl } from "../../../lib/extractors/url-policy";

export const runtime = "nodejs";
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  if (!process.env.APP_URL || request.headers.get("origin") !== new URL(process.env.APP_URL).origin) return reply({ status: "failed", code: "origin" }, 403);
  const user = await getCurrentUser();
  if (!user) return reply({ status: "failed", code: "session" }, 401);
  const client = await createServerSupabaseClient();
  const access = await client.rpc("has_app_access");
  if (access.error) return reply({ status: "failed", code: "unavailable" }, 503);
  if (!access.data) return reply({ status: "failed", code: "denied" }, 403);
  let input: { url: string; key: string }; let canonicalUrl: string;
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("json");
    const reader = request.body?.getReader();
    if (!reader) throw new Error("body");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 8192) throw new Error("size");
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel(); }
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!input || typeof input.url !== "string" || typeof input.key !== "string" || !isItemId(input.key)) throw new Error("input");
    canonicalUrl = validateSourceUrl(input.url).url;
  } catch { return reply({ status: "failed", code: "invalid_url" }, 400); }

  const lease = randomUUID();
  const inserted = await client.from("extraction_requests").insert({ user_id: user.id, idempotency_key: input.key, canonical_url: canonicalUrl, lease_id: lease });
  let cached = null;
  if (inserted.error) {
    if (inserted.error.code !== "23505") return reply({ status: "failed", code: "unavailable" }, 503);
    const existing = await client.from("extraction_requests").select("*").eq("user_id", user.id).eq("idempotency_key", input.key).single();
    if (existing.error || !existing.data) return reply({ status: "failed", code: "unavailable" }, 503);
    if (existing.data.canonical_url !== canonicalUrl) return reply({ status: "failed", code: "key_conflict" }, 409);
    cached = existing.data.result;
    if (!cached) {
      const claim = await client.from("extraction_requests").update({ lease_id: lease, started_at: new Date().toISOString() }).eq("user_id", user.id).eq("idempotency_key", input.key).eq("lease_id", existing.data.lease_id).is("result", null).lt("started_at", new Date(Date.now() - 30000).toISOString()).select("idempotency_key");
      if (claim.error) return reply({ status: "failed", code: "unavailable" }, 503);
      if (!claim.data?.length) return reply({ status: "pending", canonicalUrl }, 202);
    }
  }
  const result = cached ?? await extractMetadata(canonicalUrl);
  if (!cached) {
    const stored = await client.from("extraction_requests").update({ result }).eq("user_id", user.id).eq("idempotency_key", input.key).eq("lease_id", lease).select("idempotency_key");
    if (stored.error) return reply({ status: "failed", code: "unavailable" }, 503);
    if (!stored.data?.length) return reply({ status: "pending", canonicalUrl }, 202);
  }
  const duplicates = await client.from("sources").select("item_id").eq("user_id", user.id).eq("url", canonicalUrl).limit(1);
  if (duplicates.error) return reply({ status: "failed", code: "unavailable" }, 503);
  return reply({ ...(result as object), duplicateId: duplicates.data?.[0]?.item_id ?? null });
}
