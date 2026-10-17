import { getCurrentUser } from "../../../../../lib/auth/session";
import { createServerSupabaseClient } from "../../../../../lib/data/supabase-server";
import { itemCover } from "../../../../../lib/data/covers";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401, headers });
  const client = await createServerSupabaseClient();
  const access = await client.rpc("has_app_access");
  if (access.error || !access.data) return new Response(null, { status: access.error ? 503 : 403, headers });
  try {
    const cover = await itemCover((await params).id, user.id, new URL(request.url).searchParams.get("link") === "1");
    if (!cover) return new Response(null, { status: 404, headers });
    return new Response(cover.bytes, { headers: { ...headers, "Content-Type": cover.type } });
  } catch { return new Response(null, { status: 503, headers }); }
}
