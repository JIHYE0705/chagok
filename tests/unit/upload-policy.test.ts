import { expect, test } from "vitest";
import { matchesFileHeader, maxFileSize, validateUpload } from "../../lib/storage/upload-policy";

test("allows bounded photos and PDF, rejects executable types and invalid sizes", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) expect(validateUpload({ name: "참고", type, size: maxFileSize })).toBeTruthy();
  for (const size of [0, -1, 0.5, maxFileSize + 1, NaN]) expect(() => validateUpload({ name: "사진.png", type: "image/png", size })).toThrow();
  for (const type of ["image/svg+xml", "text/html", "application/octet-stream", "toString"]) expect(() => validateUpload({ name: "파일", type, size: 1 })).toThrow();
  expect(() => validateUpload({ name: "a\nb.png", type: "image/png", size: 1 })).toThrow();
});

test("verifies supported file signatures", () => {
  expect(matchesFileHeader(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "image/png")).toBe(true);
  expect(matchesFileHeader(new TextEncoder().encode("<script>alert(1)</script>"), "image/png")).toBe(false);
  expect(matchesFileHeader(new TextEncoder().encode("%PDF-1.7"), "application/pdf")).toBe(true);
});
