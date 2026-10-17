import "server-only";
import { readPublicResource } from "./public-resource";
import { ExtractionError, validateDestination, validateSourceUrl, validateThumbnailUrl } from "./url-policy";

export type ExtractionResult = { status: "success" | "partial" | "failed"; canonicalUrl: string; title?: string; description?: string; author?: string; thumbnailUrl?: string; code?: string };

const decode = (value: string) => value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity: string) => {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  if (!entity.startsWith("#")) return named[entity.toLowerCase()] ?? match;
  const number = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
  return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : "�";
}).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();

export function parseMetadata(html: string) {
  // shortcut: parse only static head metadata and common entities; use a full HTML parser if supported sites need more.
  const head = html.split(/<\/head\s*>|<body\b/i)[0].replace(/<!--[\s\S]*?(?:-->|$)|<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "");
  const meta = new Map<string, string>();
  for (const match of head.matchAll(/<meta\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
    const attributes = new Map([...match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)].map((attribute) => [attribute[1].toLowerCase(), attribute[2] ?? attribute[3] ?? attribute[4]]));
    const name = (attributes.get("property") ?? attributes.get("name"))?.toLowerCase();
    if (name && !meta.has(name)) meta.set(name, decode(attributes.get("content") ?? ""));
  }
  const title = [...(meta.get("og:title") || meta.get("twitter:title") || decode(head.match(/<title\b[^>]*>([^<]*)<\/title\s*>/i)?.[1] ?? ""))].slice(0, 200).join("");
  const description = [...(meta.get("og:description") || meta.get("description") || meta.get("twitter:description") || "")].slice(0, 4000).join("");
  const author = [...(meta.get("author") || meta.get("og:author") || "")].slice(0, 200).join("");
  const thumbnail = meta.get("og:image") || meta.get("twitter:image");
  return { title, description, author, ...(thumbnail ? { thumbnailUrl: thumbnail } : {}) };
}

export async function extractMetadata(value: string): Promise<ExtractionResult> {
  let canonicalUrl = "";
  try {
    const source = validateSourceUrl(value);
    canonicalUrl = source.url;
    const json = source.platform === "youtube";
    // YouTube's public oEmbed avoids the oversized watch-page scripts; descriptions are unavailable here.
    let destination = json ? `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json` : canonicalUrl;
    const signal = AbortSignal.timeout(8000);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await readPublicResource(destination, signal, json ? "json" : "html");
      if (response.redirect) { validateDestination(response.redirect); destination = response.redirect; continue; }
      let metadata;
      if (json) {
        const data = JSON.parse(response.body?.toString("utf8") ?? "");
        if (!data || data.type !== "video" || typeof data.title !== "string" || (data.author_name !== undefined && typeof data.author_name !== "string")) throw new ExtractionError("no_metadata");
        metadata = { title: [...data.title.trim()].slice(0, 200).join(""), description: "", author: [...(data.author_name ?? "").trim()].slice(0, 200).join(""), ...(typeof data.thumbnail_url === "string" ? { thumbnailUrl: data.thumbnail_url } : {}) };
      } else metadata = parseMetadata(response.body?.toString("utf8") ?? "");
      if (/^(?:log ?in|sign ?in|로그인|consent)(?:\s*[•|—-]\s*(?:Instagram|YouTube|Google))?$/i.test(metadata.title)) throw new ExtractionError("restricted");
      if (!metadata.title || /^(?:YouTube|Instagram)$/i.test(metadata.title)) throw new ExtractionError("no_metadata");
      if (metadata.thumbnailUrl) {
        try { metadata.thumbnailUrl = validateThumbnailUrl(metadata.thumbnailUrl).toString(); }
        catch { delete metadata.thumbnailUrl; }
      }
      return { canonicalUrl, ...metadata, status: metadata.description ? "success" : "partial" };
    }
    throw new ExtractionError("redirect");
  } catch (error) {
    return { status: "failed", canonicalUrl, code: error instanceof ExtractionError ? error.code : error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError") ? "timeout" : "unavailable" };
  }
}
