const hosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "instagram.com", "www.instagram.com"]);
export class ExtractionError extends Error {
  constructor(public code: string) { super(code); }
}

export function validateDestination(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new ExtractionError("invalid_url"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hosts.has(url.hostname)) throw new ExtractionError("unsupported_url");
  if (/\/(?:accounts|login|signin|consent)(?:\/|$)/i.test(url.pathname)) throw new ExtractionError("restricted");
  return url;
}

export function validateSourceUrl(value: string) {
  if (typeof value !== "string" || value.length > 2000 || /[\u0000-\u0020\u007f\\]/.test(value.trim())) throw new ExtractionError("invalid_url");
  const url = validateDestination(value.trim());
  if (url.hostname.includes("instagram")) {
    const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]{1,100})\/?$/);
    if (!match) throw new ExtractionError("unsupported_url");
    return { platform: "instagram" as const, url: `https://www.instagram.com/${match[1]}/${match[2]}/` };
  }
  const video = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.pathname === "/watch" && url.searchParams.getAll("v").length === 1 ? url.searchParams.get("v") : url.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  if (!video || !/^[A-Za-z0-9_-]{11}$/.test(video)) throw new ExtractionError("unsupported_url");
  return { platform: "youtube" as const, url: `https://www.youtube.com/watch?v=${video}` };
}

export function isPublicIPv4(address: string) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) return false;
  const [a, b, c, d] = address.split(".").map(Number);
  if ([a, b, c, d].some((part) => part > 255)) return false;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || (b === 0 && [0, 2].includes(c)) || (b === 88 && c === 99)))
    || (a === 198 && ([18, 19].includes(b) || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
