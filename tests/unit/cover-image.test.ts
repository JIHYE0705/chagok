import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ dns: vi.fn(), request: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("node:dns/promises", () => ({ resolve4: mocks.dns, default: { resolve4: mocks.dns } }));
vi.mock("node:https", () => ({ request: mocks.request, default: { request: mocks.request } }));
import { validateThumbnailUrl } from "../../lib/extractors/url-policy";
import { readPublicResource } from "../../lib/extractors/public-resource";
const url = "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg";
beforeEach(() => { vi.resetAllMocks(); mocks.dns.mockResolvedValue(["142.250.76.206"]); });
function respond(body: Buffer, headers: Record<string, string>, status = 200) {
  mocks.request.mockImplementationOnce((_url, _options, callback) => {
    const req = new EventEmitter() as EventEmitter & { end(): void };
    req.end = () => callback(Object.assign(Readable.from([body]), { statusCode: status, headers }));
    return req;
  });
}
test("only accepts explicit HTTPS platform image destinations", () => {
  expect(validateThumbnailUrl(url).hostname).toBe("i.ytimg.com");
  expect(validateThumbnailUrl("https://scontent-icn1-1.cdninstagram.com/v/t51/photo.jpg?token=123").protocol).toBe("https:");
  for (const value of ["http://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg", "https://i.ytimg.com.evil.test/image.jpg", "https://127.0.0.1/image.png", "https://cdninstagram.com.evil.test/photo.jpg", "https://user@cdninstagram.com/photo.jpg", "https://i.ytimg.com:444/vi/jNQXAC9IVRw/hqdefault.jpg", "https://cdninstagram.com/photo.svg"]) {
    expect(() => validateThumbnailUrl(value)).toThrow();
  }
});
test("image downloads pin checked DNS and send no credentials", async () => {
  respond(Buffer.from([255,216,255]), { "content-type": "image/jpeg" });
  const image = await readPublicResource(url, AbortSignal.timeout(1000), "image");
  expect(image.body).toEqual(Buffer.from([255,216,255]));
  const options = mocks.request.mock.calls[0][1];
  expect(options.headers).not.toHaveProperty("Cookie");
  expect(options.headers).not.toHaveProperty("Authorization");
  const cb = vi.fn(); options.lookup("i.ytimg.com", {}, cb);
  expect(cb).toHaveBeenCalledWith(null, "142.250.76.206", 4);
});
test("images reject private DNS, HTML, SVG, compression and excess bytes", async () => {
  mocks.dns.mockResolvedValueOnce(["10.0.0.1"]);
  await expect(readPublicResource(url, AbortSignal.timeout(1000), "image")).rejects.toThrow("private_destination");
  expect(mocks.request).not.toHaveBeenCalled();
  for (const headers of [{ "content-type": "text/html" }, { "content-type": "image/svg+xml" }, { "content-type": "image/png", "content-encoding": "gzip" }] as Record<string, string>[]) {
    respond(Buffer.from("unsafe"), headers);
    await expect(readPublicResource(url, AbortSignal.timeout(1000), "image")).rejects.toThrow("content_type");
  }
  respond(Buffer.alloc(512 * 1024 + 1), { "content-type": "image/png" });
  await expect(readPublicResource(url, AbortSignal.timeout(1000), "image")).rejects.toThrow("too_large");
});
