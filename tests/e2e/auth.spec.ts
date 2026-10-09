import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, createChunks } from "@supabase/ssr";
import { localSupabase } from "./local-supabase";

test.describe("local Supabase sessions", () => {
  test.skip(process.env.AUTH_E2E !== "1", "Run AUTH_E2E=1 with local Supabase.");
  const users: string[] = [];
  const subjects: string[] = [];

  async function session(context: BrowserContext, invited: boolean, expiry?: "refresh" | "expired") {
    const status = localSupabase();
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const subject = randomUUID();
    const email = `${subject}@example.test`;
    const password = randomUUID();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error("Could not create local auth fixture.");
    const id = created.data.user.id;
    users.push(id);
    subjects.push(subject);
    // Google itself is not automated; provision a synthetic Auth identity in the local DB.
    execFileSync("docker", ["exec", "supabase_db_chagok", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
      `insert into auth.identities (user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at) values ('${id}', '${subject}', 'google', '{"sub":"${subject}","email":"${email}"}', now(), now(), now());`],
    { stdio: "ignore" });
    if (invited) {
      const { error } = await admin.from("access_allowlist").insert({ google_subject: subject });
      if (error) throw new Error("Could not provision local invite.");
    }
    let cookies: { name: string; value: string }[] = [];
    const client = createServerClient(status.API_URL, status.ANON_KEY, {
      cookies: { getAll: () => cookies, setAll: (values) => { cookies = values; } },
    });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error || !signed.data.session) throw new Error("Could not sign in local fixture.");
    if (invited) {
      const access = await client.rpc("authorize_current_user");
      expect(access.error).toBeNull();
      expect(access.data).toBe(true);
    }
    if (expiry) {
      const value = { ...signed.data.session, expires_at: 1 };
      if (expiry === "expired") value.refresh_token = "invalid-local-refresh-token";
      const name = cookies[0].name.replace(/\.\d+$/, "");
      cookies = createChunks(name, `base64-${Buffer.from(JSON.stringify(value)).toString("base64url")}`);
    }
    await context.addCookies(cookies.filter(({ value }) => value).map(({ name, value }) => ({
      name, value, url: "http://127.0.0.1:3104", sameSite: "Lax" as const,
    })));
  }

  test.afterAll(async () => {
    const status = localSupabase();
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    for (const id of users) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error("Could not clean local user fixture.");
    }
    if (subjects.length) {
      const { error } = await admin.from("access_allowlist").delete().in("google_subject", subjects);
      if (error) throw new Error("Could not clean local invite fixtures.");
    }
  });

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
