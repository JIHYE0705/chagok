import { expect, test } from "@playwright/test";
import { supabaseFixtures } from "./linked-supabase";

test.describe("manual capture", () => {
  test.skip(process.env.AUTH_E2E !== "1", "Run AUTH_E2E=1 with linked Supabase.");
  const { session, cleanup } = supabaseFixtures();
  test.afterAll(cleanup);

  test("source survives network failure, reload, save and recipe editing on mobile", async ({ page, context }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    await session(context, true);
    await page.goto("/items/new");
    await page.getByLabel("입력 방식").selectOption("text");
    const raw = "고구마 누룽지\n\n재료:\n고구마\n올리브유\n만드는 법:\n1. 고구마를 얇게 펴요.\n2. 오븐에 구워요.";
    await page.getByLabel("원문", { exact: true }).fill(raw);
    await page.getByRole("button", { name: "원문에서 후보 정리" }).click();
    await expect(page.getByLabel("재료와 분량")).toHaveValue("고구마\n올리브유");
    await expect(page.getByLabel("온도", { exact: true })).toHaveValue("");
    await page.getByText("원문 근거와 확인 상태", { exact: true }).click();
    await expect(page.locator(".evidence-panel li").filter({ hasText: "예열 · 미기재" })).toBeVisible();
    await page.getByLabel("태그", { exact: true }).fill("간식");
    await page.route("**/items/new", async (route) => {
      if (route.request().headers()["next-action"]) await route.abort("failed");
      else await route.continue();
    });
    await page.getByRole("button", { name: "저장하기", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "입력은 그대로" })).toBeVisible();
    await expect(page.getByLabel("원문", { exact: true })).toHaveValue(raw);
    await page.unroute("**/items/new");
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await expect(page.getByRole("status")).toContainText("입력을 복구");
    await expect(page.getByLabel("태그", { exact: true })).toHaveValue("간식");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("link", { name: "취소", exact: true }).click();
    await expect(page).toHaveURL(/\/items\/new$/);
    await page.screenshot({ path: "/private/tmp/chagok-capture-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "저장하기", exact: true }).click();
    await expect(page).toHaveURL(/\/items\/[a-f0-9-]+$/);
    await expect(page.getByRole("heading", { name: "고구마 누룽지", exact: true })).toBeVisible();
    await expect(page.getByText("고구마 · 분량 미기재", { exact: true })).toBeVisible();
    await page.getByText("보존한 원문", { exact: true }).click();
    await expect(page.locator("details").filter({ hasText: "보존한 원문" }).locator("p")).toHaveText(raw);
    await page.getByRole("link", { name: "수정하기" }).click();
    await expect(page.getByLabel("원문", { exact: true })).toHaveValue(raw);
    await page.getByLabel("재료와 분량").fill("고구마 | 200g\n올리브유");
    await page.getByLabel("조리 단계", { exact: true }).fill("얇게 펴요\n구워요 | 15분 | 180도");
    await page.getByRole("button", { name: "저장하기", exact: true }).click();
    await expect(page.getByText("고구마 · 200g", { exact: true })).toBeVisible();
    await expect(page.getByText("구워요 · 15분 · 180도", { exact: true })).toBeVisible();
  });

  test("link without content preserves the URL and explicitly reports failed extraction", async ({ page, context }) => {
    test.setTimeout(60000);
    await session(context, true);
    await page.goto("/items/new");
    await page.getByLabel("입력 방식").selectOption("link");
    await page.getByLabel("원본 링크").fill("https://example.com/recipe");
    await page.getByLabel("제목", { exact: true }).fill("나중에 원문 추가");
    await page.getByRole("button", { name: "저장하기", exact: true }).click();
    await expect(page.getByRole("heading", { name: "나중에 원문 추가" })).toBeVisible();
    await expect(page.getByRole("link", { name: "원본 링크 열기" })).toHaveAttribute("href", "https://example.com/recipe");
    await page.getByText("원문 근거와 확인 상태", { exact: true }).click();
    await expect(page.locator(".evidence-panel li").filter({ hasText: "본문 · 추출 실패" })).toBeVisible();
  });
});
