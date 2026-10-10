import { expect, test } from "vitest";
import { validateSourceUrl, isPublicIPv4 } from "../../lib/extractors/url-policy";

test("canonicalizes supported HTTPS links without tracking or alternate video paths", () => {
  expect(validateSourceUrl("https://youtu.be/jNQXAC9IVRw?si=tracking").url).toBe("https://www.youtube.com/watch?v=jNQXAC9IVRw");
  expect(validateSourceUrl("https://m.youtube.com/shorts/jNQXAC9IVRw?t=20").url).toBe("https://www.youtube.com/watch?v=jNQXAC9IVRw");
  expect(validateSourceUrl("https://instagram.com/reel/ABC_123/?igsh=tracking").url).toBe("https://www.instagram.com/reel/ABC_123/");
});

test.each(["http://youtube.com/watch?v=jNQXAC9IVRw", "https://youtube.com.evil.test/watch?v=jNQXAC9IVRw", "https://user:pass@youtube.com/watch?v=jNQXAC9IVRw", "https://youtube.com:444/watch?v=jNQXAC9IVRw", "https://127.1/", "https://[::1]/", "https://localhost/", "file:///etc/passwd", "javascript:alert(1)", "https://youtube.com/redirect?q=https://localhost", "https://instagram.com/accounts/login/", "https://www.youtube.com/watch?v=jNQXAC9IVRw&v=aaaaaaaaaaa"])("rejects unsafe or unsupported URLs: %s", (url) => {
  expect(() => validateSourceUrl(url)).toThrow();
});

test.each(["0.1.2.3", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "192.0.2.1", "198.18.0.1", "198.51.100.2", "203.0.113.1", "224.0.0.1", "255.255.255.255", "::ffff:127.0.0.1"])("never dials non-public destination %s", (address) => expect(isPublicIPv4(address)).toBe(false));
test("accepts public IPv4 addresses", () => expect(isPublicIPv4("142.250.76.206")).toBe(true));
