"use client";

import { useState } from "react";
import Link from "next/link";
import type { ExtractionResult } from "../lib/extractors/metadata";
import { validateSourceUrl } from "../lib/extractors/url-policy";
import { isItemId } from "../lib/data/search";

const errors: Record<string, string> = {
  invalid_url: "YouTube 동영상·Shorts 또는 Instagram 게시물·Reel의 HTTPS 링크를 적어 주세요.",
  unsupported_url: "지원하지 않거나 안전하지 않은 주소예요.", private_destination: "안전하지 않은 목적지라 요청을 차단했어요.",
  restricted: "로그인·동의·접근 제한이 있어 공개 메타데이터를 읽지 못했어요.", timeout: "시간 안에 응답하지 않았어요.",
  too_large: "허용한 응답 크기를 넘었어요.", content_type: "지원하는 HTML 응답이 아니에요.",
  no_metadata: "확인할 수 있는 제목을 찾지 못했어요.", redirect: "안전하게 따라갈 수 없는 리디렉션이에요.",
  session: "로그인 세션을 다시 확인해 주세요. 현재 입력은 이 탭에 남아 있어요.", denied: "초대 계정만 링크를 가져올 수 있어요.",
  key_conflict: "요청과 링크가 달라요. 링크를 다시 입력해 주세요.", unavailable: "링크를 읽지 못했어요.", connection: "연결이 끊겼어요. 같은 요청의 결과를 다시 확인할 수 있어요.",
};
type Result = ExtractionResult & { duplicateId?: string | null };

export function LinkCapture({ url, requestKey, onRequestKey, onApply }: { url: string; requestKey: string; onRequestKey(key: string): void; onApply(result: Result, key: string): void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [resultKey, setResultKey] = useState("");
  async function collect() {
    let canonicalUrl: string;
    try { canonicalUrl = validateSourceUrl(url).url; }
    catch { setResult({ status: "failed", canonicalUrl: "", code: "invalid_url" }); return; }
    const key = requestKey && (waiting || !result || result.code === "connection") ? requestKey : crypto.randomUUID();
    onRequestKey(key); setResultKey(key); setBusy(true); setWaiting(false);
    try {
      const response = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: canonicalUrl, key }), signal: AbortSignal.timeout(20000) });
      const data = await response.json();
      if (data?.status === "pending") { setWaiting(true); setResult(null); return; }
      if (!["success", "partial", "failed"].includes(data?.status)) throw new Error("result");
      if (data.status !== "failed" && (data.canonicalUrl !== canonicalUrl || typeof data.title !== "string" || typeof data.description !== "string" || typeof data.author !== "string")) throw new Error("metadata");
      setResult({ status: data.status, canonicalUrl, title: data.title, description: data.description, author: data.author,
        code: typeof data.code === "string" ? data.code : undefined, duplicateId: typeof data.duplicateId === "string" && isItemId(data.duplicateId) ? data.duplicateId : null });
    } catch { setResult({ status: "failed", canonicalUrl, code: "connection" }); }
    finally { setBusy(false); }
  }
  return <section className="evidence-panel" aria-label="링크 가져오기">
    <button type="button" className="soft-button" onClick={collect} disabled={busy || !url.trim()}>{busy ? "링크를 읽고 있어요…" : waiting ? "수집 결과 확인" : result ? "다시 가져오기" : "링크 가져오기"}</button>
    {busy && <p role="status">공개 메타데이터를 확인하고 있어요. 기존 입력은 그대로 유지합니다.</p>}
    {waiting && <p role="status">같은 요청이 진행 중이에요. 잠시 후 결과를 확인해 주세요.</p>}
    {result?.duplicateId && <p role="status">이미 보관한 링크예요. <Link href={`/items/${result.duplicateId}`}>기존 항목 보기</Link> · 새 항목으로도 저장할 수 있어요.</p>}
    {result?.status === "failed" && <p role="alert">추출 실패 · {errors[result.code ?? ""] ?? errors.unavailable} 원문을 붙여넣거나 직접 작성하고, 링크만 출처로 남길 수도 있어요.</p>}
    {result && result.status !== "failed" && <><p role="status">{result.status === "partial" ? "일부 메타데이터만 가져왔어요. 설명은 미기재예요." : "제목·설명 메타데이터를 가져왔어요."} 레시피 본문 전체나 재료 분량을 확인한 결과는 아니에요.</p><h3>{result.title}</h3>{result.description && <p className="preserve-lines">{result.description}</p>}{result.author && <p>작성자 · {result.author}</p>}<button type="button" className="soft-button" onClick={() => onApply(result, resultKey)}>수집 결과로 초안 채우기</button></>}
  </section>;
}
