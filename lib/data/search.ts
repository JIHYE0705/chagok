import type { CaptureInput } from "../normalizers/normalize-item";

export type ItemInput = { title: string; summary: string; body: string; notes: string; tags: string[]; capture?: CaptureInput };
export type Filters = { q: string; tag: string; favorite: boolean; page: number };
export const isItemId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function validateItem(input: ItemInput): ItemInput {
  const title = input.title.trim();
  if (!title || [...title].length > 200) throw new Error("제목은 1~200자로 적어 주세요.");
  if ([...input.summary].length > 1000) throw new Error("요약은 1,000자까지 적을 수 있어요.");
  if ([...input.body].length > 50000) throw new Error("본문은 50,000자까지 적을 수 있어요.");
  if ([...input.notes].length > 10000) throw new Error("메모는 10,000자까지 적을 수 있어요.");
  const tags = input.tags.map((tag) => tag.trim()).filter(Boolean);
  if (tags.length > 20 || tags.some((tag) => [...tag].length > 50)) throw new Error("태그는 각각 50자 이내로, 최대 20개까지 적어 주세요.");
  return { ...input, title, tags: tags.filter((tag, i) => tags.findIndex((other) => other.toLowerCase() === tag.toLowerCase()) === i) };
}

export function parseItemForm(form: FormData): ItemInput {
  const field = (name: string) => typeof form.get(name) === "string" ? form.get(name) as string : "";
  return validateItem({ title: field("title"), summary: field("summary"), body: field("body"), notes: field("notes"), tags: field("tags").split(",") });
}

export function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const tag = typeof params.tag === "string" && isItemId(params.tag) ? params.tag : "";
  const page = typeof params.page === "string" && /^\d+$/.test(params.page) ? Math.min(100000, Math.max(1, Number(params.page))) : 1;
  return { q, tag, favorite: params.favorite === "1", page };
}

export function libraryUrl(filters: Filters, page = filters.page) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.favorite) params.set("favorite", "1");
  if (page > 1) params.set("page", String(page));
  return `/items${params.size ? `?${params}` : ""}`;
}
