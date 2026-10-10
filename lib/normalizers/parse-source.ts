import { isItemId } from "../data/search";
import type { CaptureInput } from "./normalize-item";
import { validateSourceUrl } from "../extractors/url-policy";

export function parseCaptureForm(form: FormData): CaptureInput | undefined {
  if (form.get("capture") !== "yes") return undefined;
  const field = (name: string, limit = 1000) => {
    const value = form.get(name);
    if (typeof value !== "string") return "";
    if ([...value].length > limit) throw new Error(`${name === "rawText" ? "원문" : "레시피 입력"}이 너무 길어요.`);
    return value;
  };
  const kind = field("kind");
  if (kind !== "manual" && kind !== "text" && kind !== "link") throw new Error("출처 유형을 선택해 주세요.");
  let url = field("sourceUrl", 2000).trim();
  if (kind === "link" && !url) throw new Error("원본 링크를 적어 주세요.");
  if (url) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error("올바른 HTTP 또는 HTTPS 링크를 적어 주세요."); }
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("올바른 HTTP 또는 HTTPS 링크를 적어 주세요.");
  }
  const extractionKey = field("extractionKey");
  if (extractionKey && (!isItemId(extractionKey) || kind !== "link")) throw new Error("링크 수집을 다시 확인해 주세요.");
  if (kind === "link") { try { url = validateSourceUrl(url).url; } catch { if (extractionKey) throw new Error("링크 수집을 다시 확인해 주세요."); } }
  const sourceId = field("sourceId");
  if (sourceId && !isItemId(sourceId)) throw new Error("출처를 찾을 수 없어요.");
  const lines = (name: string) => field(name, 50000).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const ingredients = lines("ingredients").map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    if (!parts[0] || parts.length > 2 || [...parts[0]].length > 500 || [...(parts[1] ?? "")].length > 500) throw new Error("재료는 한 줄에 이름 | 분량 형태로 적어 주세요.");
    return { name: parts[0], quantity: parts[1] ?? "" };
  });
  const steps = lines("steps").map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    if (!parts[0] || parts.length > 3 || [...parts[0]].length > 2000 || parts.slice(1).some((part) => [...part].length > 1000)) throw new Error("단계는 내용 | 시간 | 온도 형태로, 내용은 2,000자까지 적어 주세요.");
    return { instruction: parts[0], time: parts[1] ?? "", temperature: parts[2] ?? "" };
  });
  if (ingredients.length > 100 || steps.length > 100) throw new Error("재료와 단계는 각각 100개까지 적어 주세요.");
  return { kind, url, sourceId, ...(extractionKey ? { extractionKey } : {}), author: field("author", 200).trim(), rawText: field("rawText", 50000), ingredients, steps,
    servings: field("servings"), prepTime: field("prepTime"), cookTime: field("cookTime"), temperature: field("temperature"), tips: field("tips", 10000) };
}
