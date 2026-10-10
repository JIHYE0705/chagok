import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { supabaseFixtures } from "./linked-supabase";

const url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const origin = "http://127.0.0.1:3104";
test.describe("safe link capture", () => {
  test.skip(process.env.AUTH_E2E !== "1", "Run AUTH_E2E=1 with linked Supabase.");
  const { session, cleanup } = supabaseFixtures();
  test.afterAll(cleanup);

  test("partial cached metadata preserves manual input, guides duplicates and saves real provenance", async ({ page, context }) => {
    test.setTimeout(90000);
    const owner = await session(context, true);
    const item = await owner.client.rpc("save_item", { p_title: "이전에 저장한 링크", p_summary: "", p_body: "", p_notes: "", p_tags: [] });
    expect(item.error).toBeNull();
    expect((await owner.client.from("sources").insert({ item_id: item.data, url, kind: "link", collection_method: "paste" })).error).toBeNull();
    let key = "";
    await page.route("**/api/extract", async (route) => {
      const input = route.request().postDataJSON(); key = input.key;
      // Seed a previously collected fixture; this is not a claim about the live provider.
      expect((await owner.client.from("extraction_requests").insert({ idempotency_key: key, canonical_url: url, lease_id: randomUUID(), result: { status: "partial", canonicalUrl: url, title: "고구마 누룽지", description: "", author: "원작자" } })).error).toBeNull();
      await route.continue();
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/items/new");
    await page.getByLabel("제목", { exact: true }).fill("내가 적은 제목");
    await page.getByLabel("입력 방식").selectOption("link");
    await page.getByLabel("원본 링크").fill("https://youtu.be/jNQXAC9IVRw?si=tracking");
    await page.getByRole("button", { name: "링크 가져오기", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "일부 메타데이터" })).toBeVisible();
    await expect(page.getByRole("link", { name: "기존 항목 보기" })).toHaveAttribute("href", `/items/${item.data}`);
    await expect(page.getByLabel("제목", { exact: true })).toHaveValue("내가 적은 제목");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "수집 결과로 초안 채우기" }).click();
    await expect(page.getByLabel("원본 링크")).toHaveValue(url);
    await expect(page.getByLabel("제목", { exact: true })).toHaveValue("고구마 누룽지");
    await expect(page.getByLabel("본문", { exact: true })).toHaveValue("");
    await page.screenshot({ path: "/private/tmp/chagok-link-capture-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "저장하기", exact: true }).click();
    await expect(page).toHaveURL(/\/items\/[a-f0-9-]+$/);
    await expect(page.getByText("공개 제목·설명 메타데이터를 수집한 기록이에요.", { exact: false })).toBeVisible();
    await page.getByText("원문 근거와 확인 상태", { exact: true }).click();
    await expect(page.locator(".evidence-panel li").filter({ hasText: "설명 메타데이터 · 미기재" })).toBeVisible();
    await page.unroute("**/api/extract");
    const cached = await context.request.post("/api/extract", { headers: { origin }, data: { url: "https://youtu.be/jNQXAC9IVRw", key } });
    expect(cached.status()).toBe(200);
    expect((await cached.json()).status).toBe("partial");
  });

  test("failed collection and network retry keep inputs and create no items", async ({ page, context }) => {
    test.setTimeout(60000);
    const owner = await session(context, true);
    await page.goto("/items/new");
    await page.getByLabel("입력 방식").selectOption("link");
    await page.getByLabel("원본 링크").fill(url);
    await page.getByLabel("제목", { exact: true }).fill("보존할 제목");
    await page.getByLabel("원문", { exact: true }).fill("수집과 별개로 보존할 원문");
    let key = "";
    await page.route("**/api/extract", async (route) => { key = route.request().postDataJSON().key; await route.abort(); });
    await page.getByRole("button", { name: "링크 가져오기", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "연결이 끊겼어요" })).toBeVisible();
    const firstKey = key;
    await page.unroute("**/api/extract");
    await page.route("**/api/extract", async (route) => { key = route.request().postDataJSON().key; await route.fulfill({ json: { status: "failed", canonicalUrl: url, code: "restricted" } }); });
    await page.getByRole("button", { name: "다시 가져오기" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "로그인·동의·접근 제한" })).toBeVisible();
    expect(key).toBe(firstKey);
    await expect(page.getByLabel("원문", { exact: true })).toHaveValue("수집과 별개로 보존할 원문");
    await expect(page.getByRole("button", { name: "수집 결과로 초안 채우기" })).toHaveCount(0);
    expect((await owner.client.from("items").select("id")).data).toEqual([]);
    expect((await context.request.post("/api/extract", { headers: { origin }, data: { key: randomUUID(), url: "https://127.0.0.1/" } })).status()).toBe(400);
  });

  test("anonymous and uninvited users cannot invoke extraction; live public metadata stays honest", async ({ context }) => {
    test.setTimeout(60000);
    expect((await context.request.post("/api/extract", { headers: { origin }, data: { url, key: randomUUID() } })).status()).toBe(401);
    await session(context, false);
    expect((await context.request.post("/api/extract", { headers: { origin }, data: { url, key: randomUUID() } })).status()).toBe(403);
    await context.clearCookies();
    await session(context, true);
    const response = await context.request.post("/api/extract", { headers: { origin }, data: { url, key: randomUUID() } });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(["success", "partial", "failed"]).toContain(data.status);
    if (data.status !== "failed") expect(data.title).toMatch(/Me at.*zoo/i);
    else expect(typeof data.code).toBe("string");
    console.info("Live YouTube metadata result:", { status: data.status, code: data.code });
  });
});
