import { expect, test } from "@playwright/test";

test("home page exposes the app shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "차곡" })).toBeVisible();
});
