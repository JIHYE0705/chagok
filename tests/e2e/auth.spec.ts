import { expect, test } from "@playwright/test";
import { supabaseFixtures } from "./linked-supabase";

test.describe("linked Supabase sessions", () => {
  test.skip(process.env.AUTH_E2E !== "1", "Run AUTH_E2E=1 with the linked Supabase project.");
  const { session, cleanup } = supabaseFixtures();
  test.afterAll(cleanup);

  test("signed-out access redirects without rendering a private screen", async ({ page }) => {
    await page.goto("/items");
    await expect(page).toHaveURL(/\/login\?error=session$/);
    await expect(page.getByRole("heading", { name: "나의 보관함", exact: true })).toHaveCount(0);
  });

  test("invited session reaches the library and logout removes access", async ({ page, context }) => {
    await session(context, true);
    await page.goto("/items");
    await expect(page.getByRole("heading", { name: "나의 보관함", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/items");
    await expect(page).toHaveURL(/\/login\?error=session$/);
  });

  test("uninvited valid session is denied", async ({ page, context }) => {
    await session(context, false);
    await page.goto("/items");
    await expect(page).toHaveURL(/\/login\?error=denied$/);
    await expect(page.getByRole("alert").filter({ hasText: "초대되지 않은 계정" })).toBeVisible();
  });

  test("expired session with invalid refresh redirects to login", async ({ page, context }) => {
    await session(context, true, "expired");
    await page.goto("/items");
    await expect(page).toHaveURL(/\/login\?error=session$/);
  });

  test("session refresh persists new cookies across requests", async ({ page, context }) => {
    await session(context, true, "refresh");
    const before = await context.cookies();
    await page.goto("/items");
    await expect(page.getByRole("heading", { name: "나의 보관함", exact: true })).toBeVisible();
    expect(await context.cookies()).not.toEqual(before);
    await page.reload();
    await expect(page.getByRole("heading", { name: "나의 보관함", exact: true })).toBeVisible();
  });
});

test("cancelled OAuth shows an error and cannot use an external redirect", async ({ page }) => {
  await page.goto("/auth/callback?error=access_denied&next=https://evil.test");
  await expect(page).toHaveURL(/\/login\?error=callback$/);
});

test("unrecognized login query values do not break the page", async ({ page }) => {
  const response = await page.goto("/login?error=__proto__&error=constructor");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "차곡에 오신 걸 환영해요." })).toBeVisible();
});
