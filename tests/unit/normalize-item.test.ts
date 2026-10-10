import { expect, test } from "vitest";
import { normalizeItem } from "../../lib/normalizers/normalize-item";
import { parseCaptureForm } from "../../lib/normalizers/parse-source";

test("sweet potato draft preserves the source and leaves quantities and preheating unknown", () => {
  const raw = "  고구마 누룽지\r\n\r\n[재료]\r\n고구마\r\n올리브유\r\n[만드는 법]\r\n1. 고구마를 얇게 펴요.\r\n2) 오븐에 구워요.";
  const draft = normalizeItem(raw, "text");
  expect(draft.rawText).toBe(raw);
  expect(draft.title).toBe("고구마 누룽지");
  expect(draft.ingredients).toEqual([{ name: "고구마", quantity: "" }, { name: "올리브유", quantity: "" }]);
  expect(draft.steps).toEqual(["고구마를 얇게 펴요.", "오븐에 구워요."]);
  expect(draft.temperature).toBe("");
  expect(draft.evidence).toContainEqual(expect.objectContaining({ field: "예열", status: "missing" }));
  expect(draft.evidence).toContainEqual(expect.objectContaining({ excerpt: "1. 고구마를 얇게 펴요.", location: "7행", status: "needs_review" }));
});

test("only explicit labelled values and unambiguous ingredient quantities become candidates", () => {
  const draft = normalizeItem("감자 수프\n재료:\n감자 200 g\n소금 약간\n조리 시간: 10분\n인분: 2인분\n1. 180도로 예열할 수도 있어요.", "text");
  expect(draft.ingredients).toEqual([{ name: "감자", quantity: "200 g" }, { name: "소금", quantity: "약간" }]);
  expect(draft.cookTime).toBe("10분");
  expect(draft.servings).toBe("2인분");
  expect(draft.temperature).toBe("");
});

test("conflicting labelled values are retained as evidence and left for review", () => {
  const draft = normalizeItem("레시피\n온도: 180도\n온도: 200도", "text");
  expect(draft.temperature).toBe("");
  expect(draft.evidence.filter((e) => e.field === "온도")).toEqual([
    expect.objectContaining({ excerpt: "온도: 180도", status: "conflicting" }),
    expect.objectContaining({ excerpt: "온도: 200도", status: "conflicting" }),
  ]);
});

test("link-only input says collection has not run; whitespace-only input has no fabricated title", () => {
  expect(normalizeItem("", "link").evidence).toContainEqual(expect.objectContaining({ field: "본문", status: "failed" }));
  expect(normalizeItem(" \n\t", "text").title).toBe("");
});

test("oversized candidate lists are marked incomplete while retaining the full original", () => {
  const raw = "큰 레시피\n재료:\n" + Array.from({ length: 101 }, (_, index) => `재료 ${index + 1}`).join("\n");
  const draft = normalizeItem(raw, "text");
  expect(draft.ingredients).toHaveLength(100);
  expect(draft.truncated).toBe(true);
  expect(draft.rawText).toBe(raw);
});

test("capture boundary rejects unsafe URLs and oversized fields", () => {
  const form = new FormData();
  form.set("capture", "yes"); form.set("kind", "link"); form.set("sourceUrl", "javascript:alert(1)");
  expect(() => parseCaptureForm(form)).toThrow("링크");
  form.set("sourceUrl", "https://example.com/recipe"); form.set("ingredients", "고구마 | 200g"); form.set("steps", "굽기");
  expect(parseCaptureForm(form)).toEqual(expect.objectContaining({ url: "https://example.com/recipe", ingredients: [{ name: "고구마", quantity: "200g" }], steps: [{ instruction: "굽기", time: "", temperature: "" }] }));
  form.set("rawText", "가".repeat(50001));
  expect(() => parseCaptureForm(form)).toThrow("원문");
});
