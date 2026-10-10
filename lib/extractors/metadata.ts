import "server-only";
import { resolve4 } from "node:dns/promises";
import { request } from "node:https";
import { ExtractionError, isPublicIPv4, validateDestination, validateSourceUrl } from "./url-policy";

export type ExtractionResult = { status: "success" | "partial" | "failed"; canonicalUrl: string; title?: string; description?: string; author?: string; code?: string };

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
  return { title, description, author };
}

async function readPublicBody(value: string, signal: AbortSignal, json: boolean): Promise<{ body?: string; redirect?: string }> {
  const url = validateDestination(value);
  // shortcut: use checked IPv4 destinations; add equally pinned IPv6 when a supported platform requires it.
  const addresses = await new Promise<string[]>((resolve, reject) => {
    const abort = () => reject(new ExtractionError("timeout"));
    signal.addEventListener("abort", abort, { once: true });
    resolve4(url.hostname).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
  if (!addresses.length || addresses.some((address) => !isPublicIPv4(address))) throw new ExtractionError("private_destination");
  return new Promise((resolve, reject) => {
    const req = request(url, { signal, agent: false, family: 4, maxHeaderSize: 16384,
      headers: { Accept: json ? "application/json" : "text/html", "Accept-Encoding": "identity", "User-Agent": "Chagok-Metadata/1.0" },
      // Pin the checked address while TLS still verifies the original host; a second DNS lookup cannot rebind it.
      lookup: (_hostname, _options, callback) => callback(null, addresses[0], 4),
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        const location = response.headers.location;
        if (!location) reject(new ExtractionError("redirect"));
        else { try { resolve({ redirect: new URL(location, url).toString() }); } catch { reject(new ExtractionError("redirect")); } }
        response.destroy(); return;
      }
      if (response.statusCode !== 200) { reject(new ExtractionError([401, 403, 429].includes(response.statusCode ?? 0) ? "restricted" : "unavailable")); response.destroy(); return; }
      const contentType = json ? /^application\/json(?:;|$)/i : /^text\/html(?:;|$)/i;
      if (!contentType.test(response.headers["content-type"] ?? "") || ![undefined, "identity"].includes(response.headers["content-encoding"])) { reject(new ExtractionError("content_type")); response.destroy(); return; }
      const chunks: Buffer[] = []; let size = 0;
      response.on("error", reject);
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 512 * 1024) { reject(new ExtractionError("too_large")); response.destroy(); return; }
        chunks.push(chunk);
        if (!json && /<\/head\s*>|<body\b/i.test(Buffer.concat(chunks).toString("utf8"))) { resolve({ body: Buffer.concat(chunks).toString("utf8") }); response.destroy(); }
      });
      response.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8") }));
      response.on("aborted", () => reject(new ExtractionError("unavailable")));
    });
    req.on("error", reject); req.end();
  });
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
      const response = await readPublicBody(destination, signal, json);
      if (response.redirect) { validateDestination(response.redirect); destination = response.redirect; continue; }
      let metadata;
      if (json) {
        const data = JSON.parse(response.body ?? "");
        if (!data || data.type !== "video" || typeof data.title !== "string" || (data.author_name !== undefined && typeof data.author_name !== "string")) throw new ExtractionError("no_metadata");
        metadata = { title: [...data.title.trim()].slice(0, 200).join(""), description: "", author: [...(data.author_name ?? "").trim()].slice(0, 200).join("") };
      } else metadata = parseMetadata(response.body ?? "");
      if (/^(?:log ?in|sign ?in|로그인|consent)(?:\s*[•|—-]\s*(?:Instagram|YouTube|Google))?$/i.test(metadata.title)) throw new ExtractionError("restricted");
      if (!metadata.title || /^(?:YouTube|Instagram)$/i.test(metadata.title)) throw new ExtractionError("no_metadata");
      return { canonicalUrl, ...metadata, status: metadata.description ? "success" : "partial" };
    }
    throw new ExtractionError("redirect");
  } catch (error) {
    return { status: "failed", canonicalUrl, code: error instanceof ExtractionError ? error.code : error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError") ? "timeout" : "unavailable" };
  }
}
