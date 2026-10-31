import { expect, test } from "@playwright/test";
import { supabaseFixtures } from "./linked-supabase";

test.describe("linked Supabase library", () => {
  test.skip(process.env.AUTH_E2E !== "1", "Run AUTH_E2E=1 with the linked Supabase project.");
  const { session, cleanup } = supabaseFixtures();
  test.afterAll(cleanup);

  test("mobile library creates, searches, filters, edits and confirms deletion", async ({ page, context }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    await session(context, true);
    await page.goto("/items");
    await expect(page.getByRole("heading", { name: "아직 보관한 항목이 없어요" })).toBeVisible();
    await page.getByRole("link", { name: "새 항목 저장", exact: true }).first().click();
    await page.getByLabel("제목", { exact: true }).fill("고구마 누룽지");
    await page.getByLabel("요약", { exact: true }).fill("다시 만들고 싶은 간식");
    await page.getByLabel("본문", { exact: true }).fill("고구마를 얇게 펴요.\n분량은 미기재.");
    await page.getByLabel("메모", { exact: true }).fill("예열 여부 확인 필요");
    await page.getByLabel("태그", { exact: true }).fill("간식, 간식, SWEET, sweet");
    await page.getByRole("button", { name: "저장하기" }).click();
    await expect(page.getByRole("heading", { name: "고구마 누룽지", exact: true })).toBeVisible();
    const itemUrl = page.url();
    await expect(page.getByRole("link", { name: "#간식", exact: true })).toHaveCount(1);
    await expect(page.getByText("분량은 미기재.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "☆ 즐겨찾기 추가" }).click();
    await expect(page.getByRole("button", { name: "★ 즐겨찾기 해제" })).toBeVisible();
    await page.getByRole("link", { name: "← 보관함" }).click();
    await page.getByRole("button", { name: "목록형", exact: true }).click();
    await expect(page.locator(".library-results")).toHaveAttribute("data-view", "list");
    const restored = await page.reload();
    expect(await restored!.text()).toContain('class="library-results" data-view="list"');
    await expect(page.getByRole("button", { name: "목록형", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("보관함 검색").fill("얇게");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole("heading", { name: "고구마 누룽지" })).toBeVisible();
    await page.getByLabel("보관함 검색").fill("SWEET");
    await page.getByLabel("태그 필터").selectOption({ label: "간식" });
    await page.getByLabel("즐겨찾기만").check();
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await expect(page).toHaveURL(/favorite=1/);
    await expect(page.getByRole("heading", { name: "고구마 누룽지" })).toBeVisible();
    const filteredUrl = page.url();
    await page.getByRole("button", { name: "카드형", exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.locator(".library-results")).toHaveAttribute("data-view", "cards");
    expect(page.url()).toBe(filteredUrl);
    await expect(page.getByLabel("보관함 검색")).toHaveValue("SWEET");
    await expect(page.getByLabel("즐겨찾기만")).toBeChecked();
    await page.screenshot({ path: "/private/tmp/chagok-library-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "★ 즐겨찾기 해제" }).click();
    await expect(page.getByRole("heading", { name: "검색 결과가 없어요" })).toBeVisible();
    await page.goto(itemUrl);
    await page.getByRole("link", { name: "수정하기" }).click();
    await expect(page.getByLabel("본문", { exact: true })).toHaveValue("고구마를 얇게 펴요.\n분량은 미기재.");
    await page.getByLabel("제목", { exact: true }).fill("고구마 개선 기록");
    await page.getByLabel("태그", { exact: true }).fill("다시 만들기");
    await page.getByRole("button", { name: "저장하기" }).click();
    await expect(page.getByRole("heading", { name: "고구마 개선 기록" })).toBeVisible();
    await expect(page.getByRole("link", { name: "#간식", exact: true })).toHaveCount(0);
    await page.getByText("항목 삭제", { exact: true }).click();
    await expect(page.getByLabel("삭제할 내용을 확인했어요")).not.toBeChecked();
    await page.getByLabel("삭제할 내용을 확인했어요").check();
    await page.getByRole("button", { name: "삭제하기", exact: true }).click();
    await expect(page).toHaveURL(/\/items$/);
    await expect(page.getByRole("heading", { name: "아직 보관한 항목이 없어요" })).toBeVisible();
    await page.goto(itemUrl);
    await expect(page.getByRole("heading", { name: "항목을 찾을 수 없어요" })).toBeVisible();
  });

  test("validation failures retain inputs and tag management deduplicates then removes tags", async ({ page, context }) => {
    test.setTimeout(60000);
    await session(context, true);
    await page.goto("/items/new");
    await page.getByLabel("제목", { exact: true }).fill("보존할 제목");
    await page.getByLabel("본문", { exact: true }).fill("실패해도 잃지 않을 내용");
    await page.getByLabel("태그", { exact: true }).fill("가".repeat(51));
    await page.getByRole("button", { name: "저장하기" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "태그는" })).toBeVisible();
    await expect(page.getByLabel("제목", { exact: true })).toHaveValue("보존할 제목");
    await expect(page.getByLabel("본문", { exact: true })).toHaveValue("실패해도 잃지 않을 내용");
    await page.getByLabel("태그", { exact: true }).fill("간식");
    await page.getByRole("button", { name: "저장하기" }).click();
    await expect(page.getByRole("heading", { name: "보존할 제목" })).toBeVisible();
    await page.goto("/items");
    await page.getByText("태그 관리", { exact: true }).click();
    await page.getByLabel("새 태그", { exact: true }).fill("간식");
    await page.getByRole("button", { name: "태그 추가" }).click();
    await expect(page.getByLabel("태그 필터").locator("option", { hasText: "간식" })).toHaveCount(1);
    await page.locator(".tag-manager summary").filter({ hasText: /^간식$/ }).click();
    await page.getByLabel("간식 삭제 확인").check();
    await page.getByRole("button", { name: "간식 삭제", exact: true }).click();
    await expect(page.getByRole("link", { name: "#간식" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "보존할 제목" })).toBeVisible();
  });

  test("both library views retain private covers, long titles and a local rounded font at every width", async ({ page, context }) => {
    test.setTimeout(120000);
    const owner = await session(context, true);
    const title = "냉장고 속 남은 재료로 만드는 주말 한 끼 — 바쁜 날에도 꺼내 보기 좋은 초간단 레시피와 재료 보관 팁까지 차곡차곡 모아 두기";
    const saved = await owner.client.rpc("save_item", { p_title: title, p_summary: "감자 200 g · 우유 150 ml · 180 ℃ · ½큰술 · 2인분", p_body: "화면 검증용 예시이며 실제 조리 조건이 아닙니다.", p_notes: "", p_tags: ["집밥"] });
    expect(saved.error).toBeNull();
    expect((await owner.client.rpc("save_item", { p_title: "사진 없이 담은 레시피", p_summary: "분량 미기재", p_body: "", p_notes: "", p_tags: [] })).error).toBeNull();
    const externalFonts: string[] = [];
    page.on("request", request => { if (request.resourceType() === "font" && new URL(request.url()).hostname !== "127.0.0.1") externalFonts.push(request.url()); });
    await page.goto(`/items/${saved.data}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    // A valid one-pixel PNG tests private Storage and cover delivery, not food photography.
    await page.getByLabel("첨부 파일 선택").setInputFiles({ name: "표지.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jW3sAAAAASUVORK5CYII=", "base64") });
    await page.getByRole("button", { name: "첨부하기", exact: true }).click();
    await page.getByRole("button", { name: "표지.png 대표로 지정", exact: true }).click();
    await expect(page.getByRole("button", { name: "표지.png 대표 해제", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "← 보관함", exact: true }).click();
    const card = page.locator(".item-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [view, label] of [["cards", "카드형"], ["list", "목록형"]] as const) {
        await page.getByRole("button", { name: label, exact: true }).click();
        await expect(page.locator(".library-results")).toHaveAttribute("data-view", view);
        await expect(page.locator(".item-card")).toHaveCount(2);
        await expect(card.getByRole("heading", { name: title, exact: true })).toBeVisible();
        await expect.poll(() => card.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (width === 320 || width === 1440) await page.screenshot({ path: `output/playwright/library-${view}-${width}.png`, fullPage: true });
      }
    }
    expect(await page.evaluate(() => [...document.fonts].some(font => font.status === "loaded" && font.family.includes("nanumSquareRound")))).toBe(true);
    expect(externalFonts).toEqual([]);
    await card.getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  });

  test("other owners cannot render or mutate private items", async ({ page, context, browser }) => {
    test.setTimeout(60000);
    const owner = await session(context, true);
    const result = await owner.client.rpc("save_item", { p_title: "절대로 노출되면 안 되는 제목", p_summary: "", p_body: "비공개 본문", p_notes: "", p_tags: ["비공개 태그"] });
    expect(result.error).toBeNull();
    const otherContext = await browser.newContext();
    try {
      const other = await session(otherContext, true);
      const otherPage = await otherContext.newPage();
      await otherPage.goto(`/items/${result.data}`);
      await expect(otherPage.getByRole("heading", { name: "항목을 찾을 수 없어요" })).toBeVisible();
      await expect(otherPage.getByText("비공개 본문")).toHaveCount(0);
      await otherPage.goto(`/items/${result.data}/edit`);
      await expect(otherPage.getByRole("heading", { name: "항목을 찾을 수 없어요" })).toBeVisible();
      await otherPage.goto("/items?q=비공개");
      await expect(otherPage.getByRole("heading", { name: "검색 결과가 없어요" })).toBeVisible();
      await expect(otherPage.getByText("비공개 태그")).toHaveCount(0);
      expect((await other.client.rpc("toggle_item_favorite", { p_item_id: result.data })).error).not.toBeNull();
      expect((await other.client.rpc("save_item", { p_item_id: result.data, p_title: "탈취", p_summary: "", p_body: "", p_notes: "", p_tags: [] })).error).not.toBeNull();
      await page.goto(`/items/${result.data}`);
      await expect(page.getByRole("heading", { name: "절대로 노출되면 안 되는 제목" })).toBeVisible();
    } finally { await otherContext.close(); }
  });
});
