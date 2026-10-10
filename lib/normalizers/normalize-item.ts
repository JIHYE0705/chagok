export type CaptureKind = "manual" | "text" | "link";
export type Evidence = { field: string; excerpt: string | null; location: string | null; status: "missing" | "failed" | "needs_review" | "conflicting" };
export type CaptureInput = {
  kind: CaptureKind; url: string; author: string; sourceId: string; rawText: string;
  ingredients: { name: string; quantity: string }[]; steps: { instruction: string; time: string; temperature: string }[];
  servings: string; prepTime: string; cookTime: string; temperature: string; tips: string;
};
export const evidenceLabels = { missing: "미기재", failed: "추출 실패", needs_review: "확인 필요", conflicting: "확인 필요 · 값 충돌", confirmed: "확인됨" };
export const recipeFields = { servings: "인분", prepTime: "준비 시간", cookTime: "조리 시간", temperature: "온도", tips: "팁" } as const;

export function normalizeItem(rawText: string, kind: CaptureKind) {
  const lines = rawText.split(/\r?\n/).map((excerpt, index) => ({ text: excerpt.trim().replace(/[\t ]+/g, " "), excerpt, location: `${index + 1}행` }));
  const evidence: Evidence[] = [];
  const ingredients: CaptureInput["ingredients"] = [];
  const steps: string[] = [];
  const details = { servings: "", prepTime: "", cookTime: "", temperature: "", tips: "" };
  const title = [...(lines.find(({ text }) => text)?.text ?? "")].slice(0, 200).join("");
  if (title) evidence.push({ field: "제목", excerpt: lines.find(({ text }) => text)!.excerpt, location: lines.find(({ text }) => text)!.location, status: "needs_review" });
  let inIngredients = false;
  let truncated = false;
  for (const line of lines) {
    if (!line.text) continue;
    if (/^(?:\[재료\]|재료[:：]?|준비물[:：]?)$/.test(line.text)) { inIngredients = true; continue; }
    const step = line.text.match(/^\d+[.)]\s+(.+)$/);
    const heading = /^(?:\[.*\]|만드는 법[:：]?|조리 방법[:：]?)$/.test(line.text);
    const labelled = Object.entries(recipeFields).some(([, label]) => line.text.startsWith(`${label}:`) || line.text.startsWith(`${label}：`));
    if (step || heading || labelled) inIngredients = false;
    if ((step && steps.length >= 100) || (inIngredients && ingredients.length >= 100)) { truncated = true; continue; }
    if (step && steps.length < 100) {
      steps.push(step[1]); evidence.push({ field: `조리 단계 ${steps.length}`, excerpt: line.excerpt, location: line.location, status: "needs_review" });
    } else if (inIngredients && ingredients.length < 100) {
      // shortcut: only explicit trailing quantities are split; ambiguous ingredient text stays intact for editing.
      const match = line.text.replace(/^[-•]\s*/, "").match(/^(.+?)\s+(\d+(?:[./]\d+)?\s*(?:kg|g|ml|l|컵|큰술|작은술|개|쪽|장|스푼|tsp|tbsp)|약간|적당량)$/i);
      ingredients.push({ name: match?.[1] ?? line.text.replace(/^[-•]\s*/, ""), quantity: match?.[2] ?? "" });
      evidence.push({ field: `재료 ${ingredients.length}`, excerpt: line.excerpt, location: line.location, status: "needs_review" });
      if (!match) evidence.push({ field: `재료 ${ingredients.length} 분량`, excerpt: line.excerpt, location: line.location, status: "missing" });
    }
  }
  for (const [key, label] of Object.entries(recipeFields) as [keyof typeof details, string][]) {
    const matches = lines.filter(({ text }) => new RegExp(`^${label}[:：]\\s*.+$`).test(text));
    const values = matches.map(({ text }) => text.replace(new RegExp(`^${label}[:：]\\s*`), ""));
    const conflicting = new Set(values).size > 1;
    if (!conflicting) details[key] = values[0] ?? "";
    if (matches.length) matches.forEach(({ excerpt, location }) => evidence.push({ field: label, excerpt, location, status: conflicting ? "conflicting" : "needs_review" }));
    else evidence.push({ field: label, excerpt: null, location: null, status: "missing" });
  }
  if (!ingredients.length) evidence.push({ field: "재료", excerpt: null, location: null, status: "missing" });
  if (!steps.length) evidence.push({ field: "조리 단계", excerpt: null, location: null, status: "missing" });
  const preheat = lines.filter(({ text }) => text.includes("예열"));
  if (preheat.length) preheat.forEach(({ excerpt, location }) => evidence.push({ field: "예열", excerpt, location, status: "needs_review" }));
  else evidence.push({ field: "예열", excerpt: null, location: null, status: "missing" });
  if (kind === "link" && !rawText.trim()) evidence.push({ field: "본문", excerpt: null, location: null, status: "failed" });
  return { title, body: lines.map(({ text }) => text).join("\n").replace(/\n{3,}/g, "\n\n").trim(), rawText, ingredients, steps, ...details, evidence, truncated };
}
