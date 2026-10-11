import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { supabaseFixtures } from "./linked-supabase";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jW3sAAAAASUVORK5CYII=", "base64");
const file = { name: "완성.png", mimeType: "image/png", buffer: png };

test.describe("private attachments", () => {
  test.skip(process.env.AUTH_E2E !== "1", "Run AUTH_E2E=1 with linked Supabase.");
  const { session, cleanup } = supabaseFixtures();
  test.afterAll(cleanup);

  test("mobile upload retries a lost response, downloads privately, and cleans files on delete", async ({ page, context, browser }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 320, height: 844 });
    const owner = await session(context, true);
    await page.goto("/items/new");
    await page.getByLabel("제목", { exact: true }).fill("사진 첨부 테스트");
    // Let the server commit, then lose its response. The retry must reuse the saved item.
    await page.route("**/items/new", async (route) => {
      if (route.request().headers()["next-action"]) { await route.fetch(); await route.abort("failed"); }
      else await route.continue();
    });
    await page.getByRole("button", { name: "저장하기", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "입력은 그대로" })).toBeVisible();
    await page.unroute("**/items/new");
    await page.getByRole("button", { name: "저장하기", exact: true }).click();
    await expect(page).toHaveURL(/\/items\/[a-f0-9-]+$/);
    const itemId = page.url().split("/").pop()!;
    const items = await owner.client.from("items").select("id").eq("title", "사진 첨부 테스트");
    expect(items.data).toHaveLength(1);

    const picker = page.getByLabel("첨부 파일 선택");
    await picker.setInputFiles({ name: "script.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
    await expect(page.getByRole("status")).toContainText("JPEG");
    await picker.setInputFiles({ name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
    await expect(page.getByRole("status")).toContainText("5MB");
    await picker.setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("<script>bad</script>") });
    await page.getByRole("button", { name: "첨부하기", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("파일 내용과 형식");

    await picker.setInputFiles(file);
    let lost = false;
    await page.route("**/storage/v1/object/upload/sign/**", async (route) => {
      if (!lost && route.request().method() === "PUT") { lost = true; await route.fetch(); await route.abort("failed"); }
      else await route.continue();
    });
    await page.getByRole("button", { name: "첨부하기", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("다시 시도");
    expect(lost, "the actual upload must commit before losing its response").toBe(true);
    await page.unroute("**/storage/v1/object/upload/sign/**");
    await page.getByRole("button", { name: "첨부하기", exact: true }).click();
    await expect(page.getByRole("button", { name: "완성.png 다운로드" })).toBeVisible();
    const attachments = await owner.client.from("attachments").select("*").eq("item_id", itemId);
    expect(attachments.data).toHaveLength(1);
    const attachment = attachments.data![0];
    expect(attachment.status).toBe("ready");
    const downloaded = await owner.client.storage.from("attachments").download(attachment.storage_path);
    expect(downloaded.error).toBeNull();
    expect(Buffer.from(await downloaded.data!.arrayBuffer())).toEqual(png);

    const otherContext = await browser.newContext();
    try {
      const other = await session(otherContext, true);
      expect((await other.client.from("attachments").select("*").eq("id", attachment.id)).data).toEqual([]);
      expect((await other.client.storage.from("attachments").createSignedUrl(attachment.storage_path, 60)).error).not.toBeNull();
      expect((await other.client.storage.from("attachments").remove([attachment.storage_path])).data).toEqual([]);
    } finally { await otherContext.close(); }
    const publicUrl = owner.client.storage.from("attachments").getPublicUrl(attachment.storage_path).data.publicUrl;
    expect((await page.request.get(publicUrl)).ok()).toBe(false);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "완성.png 다운로드" }).click();
    expect((await download).suggestedFilename()).toBe("완성.png");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "/private/tmp/chagok-attachments-mobile.png", fullPage: true });

    await page.getByText("항목 삭제", { exact: true }).click();
    await page.getByLabel("삭제할 내용을 확인했어요").check();
    await page.getByRole("button", { name: "삭제하기", exact: true }).click();
    await expect(page).toHaveURL(/\/items$/);
    expect((await owner.admin.storage.from("attachments").exists(attachment.storage_path)).data).toBe(false);
    expect((await owner.admin.from("attachments").select("id").eq("item_id", itemId)).data).toEqual([]);
  });

  test("cancelled or revoked reservations reject late signed uploads", async ({ context }) => {
    test.setTimeout(90000);
    const owner = await session(context, true);
    const saved = await owner.client.rpc("save_item", { p_title: "signed cancellation", p_summary: "", p_body: "", p_notes: "", p_tags: [] });
    expect(saved.error).toBeNull();
    const reserve = async () => {
      const result = await owner.client.rpc("reserve_attachment", { p_item_id: saved.data!, p_key: randomUUID(), p_name: file.name, p_mime: "image/png", p_size: png.length });
      expect(result.error).toBeNull();
      const attachment = result.data!;
      const signed = await owner.client.storage.from("attachments").createSignedUploadUrl(attachment.storage_path);
      expect(signed.error).toBeNull();
      return { attachment, token: signed.data!.token };
    };
    const cancelled = await reserve();
    expect((await owner.client.from("attachments").delete().eq("id", cancelled.attachment.id)).error).toBeNull();
    const late = await owner.client.storage.from("attachments").uploadToSignedUrl(cancelled.attachment.storage_path, cancelled.token, png, { contentType: "image/png" });
    expect(late.error).not.toBeNull();
    expect((await owner.admin.storage.from("attachments").exists(cancelled.attachment.storage_path)).data).toBe(false);

    const revoked = await reserve();
    expect((await owner.admin.from("access_allowlist").delete().eq("google_subject", owner.subject)).error).toBeNull();
    expect((await owner.client.storage.from("attachments").uploadToSignedUrl(revoked.attachment.storage_path, revoked.token, png, { contentType: "image/png" })).error).not.toBeNull();
    expect((await owner.admin.storage.from("attachments").exists(revoked.attachment.storage_path)).data).toBe(false);
  });
});
