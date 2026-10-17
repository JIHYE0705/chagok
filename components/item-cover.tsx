"use client";

import Image from "next/image";
import { useRef, useState } from "react";

export function ItemCover({ itemId, title, type, version, representative = false, detail = false }: { itemId: string; title: string; type: string; version: string; representative?: boolean; detail?: boolean }) {
  const [failure, setFailure] = useState({ version: "", stage: 0 });
  const stage = failure.version === version ? failure.stage : 0;
  const dialog = useRef<HTMLDialogElement>(null);
  const src = `/api/items/${itemId}/cover?v=${encodeURIComponent(version)}${representative && stage > 0 ? "&link=1" : ""}`;
  const hasImage = Boolean(version) && stage < (representative ? 2 : 1);
  const fail = () => setFailure({ version, stage: stage + 1 });
  return <div className={`item-cover${detail ? " item-cover-detail" : ""}`}>
    {hasImage ? <>
      <Image src={src} alt={`${title} 표지`} width={640} height={400} unoptimized onError={fail} />
      {detail && <button type="button" className="soft-button cover-expand" onClick={() => dialog.current?.showModal()}>사진 전체 보기</button>}
    </> : <div className="cover-placeholder" role="img" aria-label={`${type === "recipe" ? "레시피" : "정보"} 기본 표지`}><span aria-hidden="true">{type === "recipe" ? "🥣" : "📒"}</span><span>{type === "recipe" ? "맛있는 기록 한 장" : "차곡차곡 모은 기록"}</span></div>}
    {hasImage && detail && <dialog ref={dialog} className="cover-dialog" aria-label="표지 사진 전체 보기">
      <button type="button" className="soft-button" autoFocus onClick={() => dialog.current?.close()}>사진 닫기</button>
      <Image src={src} alt={`${title} 전체 사진`} width={1200} height={1200} unoptimized onError={() => { fail(); dialog.current?.close(); }} />
    </dialog>}
  </div>;
}
