import { expect, test } from "@playwright/test";
import { supabaseFixtures } from "./linked-supabase";

test.describe("recipe detail layout", () => {
  test.skip(process.env.AUTH_E2E !== "1", "Run AUTH_E2E=1 with linked Supabase.");
  const { session, cleanup } = supabaseFixtures();
  test.afterAll(cleanup);

  test("recipe information precedes long body text at every width, with and without a cover", async ({ page, context }) => {
    test.setTimeout(120000);
    const { client } = await session(context, true);
    const title = "냉장고 속 남은 재료로 만드는 주말 한 끼 — 재료와 조리 단계를 천천히 읽으며 다시 만들어 먹는 감자 수프";
    const longName = "껍질을 벗겨 작게 썰어 둔 감자와 냉장고에 남은 채소";
    const raw = "보존할 원문\n감자 200 g\n미기재인 분량과 시간은 추측하지 않아요.";
    const saved = await client.rpc("save_capture", {
      p_title: title, p_summary: "요약은 조리 정보 다음에 읽을 수 있어요.", p_body: "긴 본문 예시예요. ".repeat(150), p_notes: "다음에는 소금 양을 직접 확인하기.", p_tags: ["집밥"],
      p_capture: { kind: "text", url: "https://example.com/recipe", author: "원작자", rawText: raw,
        servings: "1~2인분", prepTime: "", cookTime: "15분", temperature: "180 ℃", tips: "조리 조건은 표시 검증용 예시입니다.",
        ingredients: [{ name: longName, quantity: "200 g" }, { name: "우유", quantity: "150 ml" }, { name: "소금", quantity: "" }, { name: "올리브유", quantity: "½큰술" }],
        steps: [{ instruction: "감자와 채소를 씻어 작게 썰어요.\n수치와 단위, 원문에 없는 내용은 그대로 확인해 주세요.", time: "", temperature: "" }, { instruction: "팬에 재료를 넣고 천천히 저어요. ".repeat(25), time: "15분", temperature: "180 ℃" }],
        evidence: [{ field: "소금 분량", status: "missing", excerpt: null, location: null }, { field: "온도", status: "conflicting", excerpt: "원문 간 온도가 달라요.", location: "2행" }],
      },
    });
    expect(saved.error).toBeNull();
    await page.goto(`/items/${saved.data}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.locator(".recipe-meta dd")).toHaveText(["1~2인분", "미기재", "15분", "180 ℃"]);
    await expect(page.locator(".ingredient-list dt")).toHaveText([longName, "우유", "소금", "올리브유"]);
    await expect(page.locator(".ingredient-list dd")).toHaveText(["200 g", "150 ml", "분량 미기재", "½큰술"]);
    await expect(page.locator(".recipe-steps li")).toHaveCount(2);
    await expect(page.locator(".step-conditions")).toHaveText("시간 15분온도 180 ℃");
    for (const cover of [false, true]) {
      if (cover) {
        // Confirm a hydrated interaction before selecting a file; native file changes cannot be replayed.
        await page.getByRole("button", { name: "☆ 즐겨찾기 추가", exact: true }).click();
        await expect(page.getByRole("button", { name: "★ 즐겨찾기 해제", exact: true })).toBeVisible();
        // The PNG verifies private cover delivery, not food photography.
        await page.getByLabel("첨부 파일 선택").setInputFiles({ name: "상세표지.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jW3sAAAAASUVORK5CYII=", "base64") });
        await page.getByRole("button", { name: "첨부하기", exact: true }).click();
        await page.getByRole("button", { name: "상세표지.png 대표로 지정", exact: true }).click();
        await expect(page.getByRole("button", { name: "상세표지.png 대표 해제", exact: true })).toBeVisible();
      }
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(() => document.fonts.ready);
        const ingredients = await page.locator(".recipe-ingredients").boundingBox();
        const instructions = await page.locator(".recipe-instructions").boundingBox();
        if (width >= 768) {
          expect(Math.abs(ingredients!.y - instructions!.y)).toBeLessThan(1);
          expect(instructions!.x).toBeGreaterThan(ingredients!.x + ingredients!.width);
        } else expect(instructions!.y).toBeGreaterThanOrEqual(ingredients!.y + ingredients!.height);
        const body = await page.locator(".detail-text").filter({ has: page.getByRole("heading", { name: "본문", exact: true }) }).boundingBox();
        expect(body!.y).toBeGreaterThan(instructions!.y);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (cover) {
          await expect.poll(() => page.getByAltText(`${title} 표지`, { exact: true }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
          expect((await page.locator(".item-cover-detail").boundingBox())!.height).toBeLessThanOrEqual(220);
        } else await expect(page.locator(".item-cover-detail")).toBeHidden();
        if (width === 320 || width === 1440) await page.screenshot({ path: `output/playwright/detail-${cover ? "photo" : "text"}-${width}.png`, fullPage: true, style: "nextjs-portal { display: none; }" });
      }
    }
    await page.getByRole("button", { name: "사진 전체 보기", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "표지 사진 전체 보기" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "사진 전체 보기", exact: true })).toBeFocused();
    await page.getByText("원문 근거와 확인 상태", { exact: true }).click();
    await expect(page.locator(".evidence-panel li").filter({ hasText: "확인 필요 · 값 충돌" })).toBeVisible();
    await page.getByText("보존한 원문", { exact: true }).click();
    await expect(page.locator(".detail-raw p")).toHaveText(raw);
    await expect(page.getByRole("link", { name: "원본 링크 열기", exact: true })).toHaveAttribute("href", "https://example.com/recipe");
    await page.route("**/api/items/**/cover?**", route => route.abort());
    await page.reload();
    await expect(page.locator(".item-cover-detail")).toBeHidden();
    await expect(page.getByRole("heading", { name: "재료", exact: true })).toBeVisible();
  });

  test("missing recipe fields remain explicit and a plain item keeps its body", async ({ page, context }) => {
    const { client } = await session(context, true);
    const saved = await client.rpc("save_capture", { p_title: "아직 정리하지 않은 레시피", p_summary: "", p_body: "보존할 본문", p_notes: "", p_tags: [], p_capture: { kind: "manual", url: "", rawText: "", author: "", ingredients: [], steps: [], evidence: [] } });
    expect(saved.error).toBeNull();
    await page.goto(`/items/${saved.data}`);
    await expect(page.locator(".recipe-meta dd")).toHaveText(["미기재", "미기재", "미기재", "미기재"]);
    await expect(page.getByText("등록된 재료가 없어요.", { exact: true })).toBeVisible();
    await expect(page.getByText("등록된 조리 단계가 없어요.", { exact: true })).toBeVisible();
    const plain = await client.rpc("save_item", { p_title: "직접 적은 기록", p_body: "원문을 그대로 읽어요.", p_summary: "", p_notes: "", p_tags: [] });
    expect(plain.error).toBeNull();
    await page.goto(`/items/${plain.data}`);
    await expect(page.getByText("원문을 그대로 읽어요.", { exact: true })).toBeVisible();
    await expect(page.locator(".recipe-layout")).toHaveCount(0);
  });
});
