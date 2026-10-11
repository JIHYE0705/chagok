export const maxFileSize = 5 * 1024 * 1024;
export const maxAttachments = 10;
export const uploadTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as const;

export function validateUpload(file: { name: string; type: string; size: number }) {
  if (!file || typeof file.name !== "string" || !file.name.trim() || file.name.length > 200 || /[\u0000-\u001f\u007f]/.test(file.name)) throw new Error("파일 이름을 확인해 주세요.");
  if (!Object.hasOwn(uploadTypes, file.type)) throw new Error("JPEG·PNG·WebP 사진이나 PDF만 첨부할 수 있어요.");
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > maxFileSize) throw new Error("파일은 0바이트보다 크고 5MB 이하여야 해요.");
  return uploadTypes[file.type as keyof typeof uploadTypes];
}

export function matchesFileHeader(bytes: Uint8Array, type: string) {
  const starts = (...prefix: number[]) => prefix.every((value, i) => bytes[i] === value);
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  return type === "image/jpeg" ? starts(255, 216, 255)
    : type === "image/png" ? starts(137, 80, 78, 71, 13, 10, 26, 10)
      : type === "image/webp" ? text(0, 4) === "RIFF" && text(8, 12) === "WEBP"
        : type === "application/pdf" && text(0, 5) === "%PDF-";
}
