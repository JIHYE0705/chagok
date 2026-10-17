export function coverVersion(attachments: { id: string; is_cover: boolean }[], sources: { extraction_key: string | null }[]) {
  return attachments.find((file) => file.is_cover)?.id || sources.find((source) => source.extraction_key)?.extraction_key || "";
}
