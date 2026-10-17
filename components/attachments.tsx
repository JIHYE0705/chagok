"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setItemCoverAction, signAttachmentAction, finishAttachmentAction, readAttachmentAction, deleteAttachmentAction } from "../app/(protected)/items/attachment-actions";
import { maxAttachments, validateUpload, matchesFileHeader, uploadTypes } from "../lib/storage/upload-policy";
import type { Tables } from "../lib/data/types";

export function Attachments({ itemId, attachments }: { itemId: string; attachments: Tables<"attachments">[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<{ file: File; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const cancelled = useRef(false);
  const picker = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => { cancelled.current = true; xhr.current?.abort(); }, []);

  async function upload() {
    if (!selected || busy) return;
    setBusy(true); setMessage(""); setProgress(0); cancelled.current = false;
    try {
      const { file, key } = selected;
      validateUpload(file);
      if (!matchesFileHeader(new Uint8Array(await file.slice(0, 16).arrayBuffer()), file.type)) throw new Error("파일 내용과 형식이 달라요. 올바른 파일을 선택해 주세요.");
      const result = await signAttachmentAction(itemId, key, { name: file.name, type: file.type, size: file.size });
      if (result.error || !result.upload) throw new Error(result.error);
      if (cancelled.current) throw new Error("업로드를 중단했어요. 재시도하거나 미완료 첨부를 삭제해 주세요.");
      if (result.upload.signedUrl) {
        await new Promise<void>((resolve, reject) => {
          const request = new XMLHttpRequest(); xhr.current = request;
          request.open("PUT", result.upload!.signedUrl);
          request.setRequestHeader("Content-Type", file.type);
          request.timeout = 60000;
          request.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
          request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("업로드하지 못했어요. 같은 파일로 다시 시도해 주세요."));
          request.onerror = request.ontimeout = () => reject(new Error("연결이 끊겼어요. 파일은 그대로 두고 다시 시도해 주세요."));
          request.onabort = () => reject(new Error("업로드를 중단했어요. 재시도하거나 미완료 첨부를 삭제해 주세요."));
          request.send(file);
        });
      }
      if (cancelled.current) throw new Error("업로드를 중단했어요. 재시도하거나 미완료 첨부를 삭제해 주세요.");
      const finished = await finishAttachmentAction(result.upload.id);
      if (finished.error) throw new Error(finished.error);
      setSelected(null); if (picker.current) picker.current.value = "";
      setMessage("첨부했어요.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "첨부하지 못했어요. 다시 시도해 주세요."); }
    finally { xhr.current = null; setBusy(false); router.refresh(); }
  }

  async function chooseCover(id: string | null) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const result = await setItemCoverAction(itemId, id);
      setMessage(result.error || (id ? "대표 사진을 지정했어요." : "대표 사진을 해제했어요."));
    } catch { setMessage("대표 사진을 바꾸지 못했어요. 다시 시도해 주세요."); }
    finally { setBusy(false); router.refresh(); }
  }

  async function remove(id: string) {
    if (busy || !window.confirm("이 첨부 파일을 삭제할까요?")) return;
    setBusy(true);
    try {
      const result = await deleteAttachmentAction(id);
      setMessage(result.error || "첨부를 삭제했어요.");
      if (!result.error && selected?.key === id) { setSelected(null); if (picker.current) picker.current.value = ""; }
    } catch { setMessage("삭제하지 못했어요. 다시 시도해 주세요."); }
    finally { setBusy(false); router.refresh(); }
  }

  async function open(id: string, name: string) {
    setBusy(true); setMessage("");
    try {
      const result = await readAttachmentAction(id);
      if (result.error) throw new Error(result.error);
      const response = await fetch(result.url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error("첨부를 내려받지 못했어요. 다시 시도해 주세요.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = name;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setMessage(error instanceof Error ? error.message : "첨부를 열지 못했어요."); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="attachments-heading">
    <h2 id="attachments-heading">사진·참고 파일</h2>
    <p className="muted">비공개로 보관해요. JPEG·PNG·WebP·PDF, 파일당 5MB, 항목당 10개까지 첨부할 수 있어요.</p>
    <ul className="attachment-list">
      {attachments.map((attachment) => <li key={attachment.id}>
        <span className="attachment-name">{attachment.is_cover && "대표 사진 · "}{attachment.file_name} · {(attachment.size_bytes / 1024).toFixed(0)}KB{attachment.status !== "ready" && " · 미완료"}</span>
        <div className="library-toolbar">
          {attachment.status === "ready" && <button type="button" className="soft-button" disabled={busy} onClick={() => open(attachment.id, attachment.file_name)} aria-label={`${attachment.file_name} 다운로드`}>다운로드</button>}
          {attachment.status === "ready" && attachment.mime_type.startsWith("image/") && <button type="button" className="soft-button" disabled={busy} onClick={() => chooseCover(attachment.is_cover ? null : attachment.id)} aria-label={`${attachment.file_name} ${attachment.is_cover ? "대표 해제" : "대표로 지정"}`}>{attachment.is_cover ? "대표 해제" : "대표로 지정"}</button>}
          <button type="button" className="soft-button" disabled={busy} onClick={() => remove(attachment.id)} aria-label={`${attachment.file_name} 첨부 삭제`}>첨부 삭제</button>
        </div>
      </li>)}
    </ul>
    {!attachments.length && <p>아직 첨부한 파일이 없어요.</p>}
    <div className="item-field"><label htmlFor="attachment-file">첨부 파일 선택</label><input ref={picker} id="attachment-file" type="file" accept={Object.keys(uploadTypes).join(",")} disabled={busy} onChange={(event) => {
      const file = event.target.files?.[0];
      setMessage("");
      if (!file) { setSelected(null); return; }
      try {
        validateUpload(file);
        const pending = attachments.find((a) => a.status !== "ready" && a.file_name === file.name && a.mime_type === file.type && a.size_bytes === file.size);
        if (!pending && attachments.length >= maxAttachments) throw new Error("첨부는 항목당 10개까지 가능해요.");
        setSelected({ file, key: pending?.id ?? crypto.randomUUID() });
      } catch (error) { setSelected(null); event.target.value = ""; setMessage(error instanceof Error ? error.message : "파일을 확인해 주세요."); }
    }} /></div>
    <div className="library-toolbar">
      <button type="button" className="soft-button" disabled={busy || !selected} onClick={upload}>첨부하기</button>
      {busy && selected && <button type="button" className="soft-button" onClick={() => { cancelled.current = true; xhr.current?.abort(); }}>업로드 중단</button>}
    </div>
    {busy && selected && <progress max={100} value={progress} aria-label="첨부 업로드 진행률" />}
    {message && <p role="status">{message}</p>}
    {attachments.some((a) => a.status !== "ready") && <p className="muted">미완료 파일은 같은 파일을 다시 선택해 재시도하거나 첨부 삭제로 정리해 주세요.</p>}
  </section>;
}
