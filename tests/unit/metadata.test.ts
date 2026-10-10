import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dns: vi.fn(), request: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("node:dns/promises", () => ({ resolve4: mocks.dns, default: { resolve4: mocks.dns } }));
vi.mock("node:https", () => ({ request: mocks.request, default: { request: mocks.request } }));
import { extractMetadata, parseMetadata } from "../../lib/extractors/metadata";

beforeEach(() => { vi.resetAllMocks(); mocks.dns.mockResolvedValue(["142.250.76.206"]); });
function respond(body: string, status = 200, headers: Record<string, string> = { "content-type": "text/html" }) {
  mocks.request.mockImplementationOnce((_url, _options, callback) => {
    const req = new EventEmitter() as EventEmitter & { end(): void };
    req.end = () => {
      const response = Object.assign(Readable.from([Buffer.from(body)]), { statusCode: status, headers });
      callback(response);
    };
    return req;
  });
}
const link = "https://www.instagram.com/p/ABC_123/";

test("parses static metadata in either attribute order without executing scripts or trusting body text", () => {
  expect(parseMetadata(`<head><!-- <meta property="og:title" content="fake"> --><script>const x = '<meta property="og:title" content="fake">';</script><meta content='고구마 &amp; &#x1f360;' property='og:title'><meta name=description content='분량 미기재'><meta name='author' content='원작자'></head><body><meta property="og:title" content="body"></body>`)).toEqual({ title: "고구마 & 🍠", description: "분량 미기재", author: "원작자" });
});
test("returns metadata success without fabricating recipe values", async () => {
  respond('<head><meta property="og:title" content="고구마"><meta property="og:description" content="분량 미기재"></head>');
  expect(await extractMetadata(link)).toEqual({ status: "success", canonicalUrl: link, title: "고구마", description: "분량 미기재", author: "" });
  const options = mocks.request.mock.calls[0][1];
  const callback = vi.fn(); options.lookup("www.youtube.com", {}, callback);
  expect(callback).toHaveBeenCalledWith(null, "142.250.76.206", 4);
  expect(options.agent).toBe(false);
  expect(options.headers).not.toHaveProperty("Cookie");
});
test("marks title-only metadata partial and generic login pages failed", async () => {
  respond("<title>간식</title>");
  expect(await extractMetadata(link)).toMatchObject({ status: "partial", description: "" });
  respond("<title>Login • Instagram</title>");
  expect(await extractMetadata(link)).toMatchObject({ status: "failed", code: "restricted" });
  respond("<title>Login guide for beginners</title>");
  expect(await extractMetadata(link)).toMatchObject({ status: "partial", title: "Login guide for beginners" });
});
test("rejects DNS rebinding before making a request", async () => {
  mocks.dns.mockResolvedValue(["142.250.76.206", "127.0.0.1"]);
  expect(await extractMetadata(link)).toMatchObject({ status: "failed", code: "private_destination" });
  expect(mocks.request).not.toHaveBeenCalled();
});
test("revalidates every redirect and rejects private or unsupported destinations", async () => {
  respond("", 302, { location: "https://169.254.169.254/latest/meta-data" });
  expect(await extractMetadata(link)).toMatchObject({ status: "failed", code: "unsupported_url" });
  expect(mocks.request).toHaveBeenCalledTimes(1);
});
test("checks DNS again for an allowed redirected host and enforces redirect bounds", async () => {
  respond("", 302, { location: "/watch?v=jNQXAC9IVRw" });
  mocks.dns.mockResolvedValueOnce(["142.250.76.206"]).mockResolvedValueOnce(["10.0.0.1"]);
  expect(await extractMetadata(link)).toMatchObject({ code: "private_destination" });
  expect(mocks.request).toHaveBeenCalledTimes(1);
});
test("rejects invalid content type, too-large head, and access restrictions", async () => {
  respond("binary", 200, { "content-type": "application/octet-stream" });
  expect(await extractMetadata(link)).toMatchObject({ code: "content_type" });
  respond(" ".repeat(512 * 1024 + 1));
  expect(await extractMetadata(link)).toMatchObject({ code: "too_large" });
  respond("", 403);
  expect(await extractMetadata(link)).toMatchObject({ code: "restricted" });
});
test("request aborts report timeout without exposing raw errors", async () => {
  mocks.request.mockImplementation(() => {
    const req = new EventEmitter() as EventEmitter & { end(): void };
    req.end = () => req.emit("error", Object.assign(new Error("private details"), { name: "AbortError" }));
    return req;
  });
  expect(await extractMetadata(link)).toMatchObject({ status: "failed", code: "timeout" });
});
test("uses bounded public YouTube oEmbed and marks its absent description partial", async () => {
  respond(JSON.stringify({ type: "video", title: "Me at the zoo", author_name: "jawed", html: "<iframe>never render</iframe>" }), 200, { "content-type": "application/json" });
  expect(await extractMetadata("https://youtu.be/jNQXAC9IVRw")).toEqual({ status: "partial", canonicalUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw", title: "Me at the zoo", description: "", author: "jawed" });
  expect(mocks.request.mock.calls[0][0].pathname).toBe("/oembed");
  respond(JSON.stringify({ type: "video", title: { unsafe: true } }), 200, { "content-type": "application/json" });
  expect(await extractMetadata("https://youtu.be/jNQXAC9IVRw")).toMatchObject({ status: "failed", code: "no_metadata" });
});
test("intentional stream destruction cannot mask the response-size error", async () => {
  mocks.request.mockImplementationOnce((_url, _options, callback) => {
    const req = new EventEmitter() as EventEmitter & { end(): void };
    req.end = () => {
      const stream = new EventEmitter();
      const response = Object.assign(stream, { statusCode: 200, headers: { "content-type": "text/html" }, destroy: () => stream.emit("aborted") });
      callback(response);
      response.emit("data", Buffer.alloc(512 * 1024 + 1));
    };
    return req;
  });
  expect(await extractMetadata(link)).toMatchObject({ code: "too_large" });
});
