import type { CaptureInput, normalizeItem } from "../normalizers/normalize-item";

export interface AiProvider {
  analyze(input: Pick<CaptureInput, "kind" | "rawText">): Promise<ReturnType<typeof normalizeItem>>;
}
