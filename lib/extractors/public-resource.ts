import "server-only";
import { resolve4 } from "node:dns/promises";
import { request } from "node:https";
import { ExtractionError, isPublicIPv4, validateDestination, validateThumbnailUrl } from "./url-policy";

export async function readPublicResource(value: string, signal: AbortSignal, mode: "json" | "html" | "image"): Promise<{ body?: Buffer; redirect?: string; contentType?: string }> {
  const url = mode === "image" ? validateThumbnailUrl(value) : validateDestination(value);
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
      headers: { Accept: mode === "json" ? "application/json" : mode === "image" ? "image/jpeg,image/png,image/webp" : "text/html", "Accept-Encoding": "identity", "User-Agent": "Chagok-Metadata/1.0" },
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
      const contentType = mode === "json" ? /^application\/json(?:;|$)/i : mode === "image" ? /^image\/(?:jpeg|png|webp)(?:;|$)/i : /^text\/html(?:;|$)/i;
      if (!contentType.test(response.headers["content-type"] ?? "") || ![undefined, "identity"].includes(response.headers["content-encoding"])) { reject(new ExtractionError("content_type")); response.destroy(); return; }
      const chunks: Buffer[] = []; let size = 0;
      response.on("error", reject);
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 512 * 1024) { reject(new ExtractionError("too_large")); response.destroy(); return; }
        chunks.push(chunk);
        if (mode === "html" && /<\/head\s*>|<body\b/i.test(Buffer.concat(chunks).toString("utf8"))) { resolve({ body: Buffer.concat(chunks), contentType: response.headers["content-type"]?.split(";")[0].toLowerCase() }); response.destroy(); }
      });
      response.on("end", () => resolve({ body: Buffer.concat(chunks), contentType: response.headers["content-type"]?.split(";")[0].toLowerCase() }));
      response.on("aborted", () => reject(new ExtractionError("unavailable")));
    });
    req.on("error", reject); req.end();
  });
}
