"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveItemAction, type ActionState } from "../app/(protected)/items/actions";
import type { ItemInput } from "../lib/data/search";
import { normalizeItem, recipeFields, type CaptureKind } from "../lib/normalizers/normalize-item";
import { EvidencePanel } from "./evidence-panel";

type Props = { ownerId: string; id?: string | null; initial?: ItemInput };
const subscribe = () => () => {};

export function ItemForm(props: Props) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return ready ? <Editor {...props} /> : <p role="status">입력 화면을 준비하고 있어요.</p>;
}

function Editor({ ownerId, id = null, initial }: Props) {
  const router = useRouter();
  const capture = initial?.capture;
  const defaults = {
    title: initial?.title ?? "", summary: initial?.summary ?? "", body: initial?.body ?? "", notes: initial?.notes ?? "", tags: initial?.tags.join(", ") ?? "",
    kind: capture?.kind ?? "manual", sourceUrl: capture?.url ?? "", author: capture?.author ?? "", rawText: capture?.rawText ?? "",
    ingredients: capture?.ingredients.map((entry) => [entry.name, entry.quantity].join(" | ")).join("\n") ?? "",
    steps: capture?.steps.map((entry) => [entry.instruction, entry.time, entry.temperature].join(" | ")).join("\n") ?? "",
    servings: capture?.servings ?? "", prepTime: capture?.prepTime ?? "", cookTime: capture?.cookTime ?? "", temperature: capture?.temperature ?? "", tips: capture?.tips ?? "",
  };
  const draftKey = `chagok:draft:${ownerId}:${id ?? "new"}`;
  const [editor, setEditor] = useState(() => {
    try {
      const stored = sessionStorage.getItem(draftKey);
      const restored = stored ? JSON.parse(stored) : null;
      if (restored && Object.keys(defaults).every((key) => typeof restored[key] === "string") && ["manual", "text", "link"].includes(restored.kind)) {
        return { fields: Object.fromEntries(Object.keys(defaults).map((key) => [key, restored[key]])) as typeof defaults, dirty: true, warning: "이 탭에서 작성하던 입력을 복구했어요." };
      }
      return { fields: defaults, dirty: false, warning: "" };
    } catch { return { fields: defaults, dirty: false, warning: "이 브라우저에서는 입력 복구를 사용할 수 없어요. 화면을 닫기 전에 저장해 주세요." }; }
  });
  const { fields, dirty, warning } = editor;
  const submitted = useRef(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (previous, form) => {
    try { return await saveItemAction(id, previous, form); }
    catch { return { error: "연결하지 못했어요. 입력은 그대로 두고 다시 저장해 주세요." }; }
  }, { error: "" });
  useEffect(() => {
    if (!state.saved) return;
    submitted.current = true;
    try { sessionStorage.removeItem(draftKey); } catch { /* Storage may be unavailable. */ }
    router.push(`/items/${state.saved}`); router.refresh();
  }, [state.saved, draftKey, router]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { if (!submitted.current) { event.preventDefault(); event.returnValue = ""; } };
    const navigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link && !submitted.current && !window.confirm("아직 저장하지 않은 입력이 있어요. 화면을 떠날까요?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
  const update = (next: typeof fields) => {
    let nextWarning = "";
    try { sessionStorage.setItem(draftKey, JSON.stringify(next)); }
    catch { nextWarning = "입력을 임시 보관하지 못했어요. 화면을 닫기 전에 저장해 주세요."; }
    setEditor({ fields: next, dirty: true, warning: nextWarning });
  };
  const change = (name: keyof typeof fields, value: string) => update({ ...fields, [name]: value });
  const draft = normalizeItem(fields.rawText, fields.kind as CaptureKind);
  const normalize = () => {
    if ((fields.title || fields.body || fields.ingredients || fields.steps) && !window.confirm("작성한 정리 내용을 원문 후보로 바꿀까요? 원문은 그대로 남아요.")) return;
    update({ ...fields, title: draft.title, body: draft.body, ingredients: draft.ingredients.map((entry) => entry.quantity ? `${entry.name} | ${entry.quantity}` : entry.name).join("\n"), steps: draft.steps.join("\n"), servings: draft.servings, prepTime: draft.prepTime, cookTime: draft.cookTime, temperature: draft.temperature, tips: draft.tips });
  };
  return (
    <form action={action} className="item-form">
      <input type="hidden" name="capture" value="yes" /><input type="hidden" name="sourceId" value={capture?.sourceId ?? ""} />
      <fieldset disabled={pending || Boolean(state.saved)}>
        <div className="item-field"><label htmlFor="capture-kind">입력 방식</label><select id="capture-kind" name="kind" value={fields.kind} onChange={(e) => change("kind", e.target.value)}><option value="manual">직접 작성</option><option value="text">텍스트 붙여넣기</option><option value="link">링크 입력</option></select></div>
        <div className="item-field"><label htmlFor="source-url">원본 링크</label><input id="source-url" name="sourceUrl" type="url" value={fields.sourceUrl} onChange={(e) => change("sourceUrl", e.target.value)} maxLength={2000} required={fields.kind === "link"} /></div>
        {fields.kind === "link" && <p className="muted">링크 자동 수집은 아직 제공하지 않아요. 아래에 캡션이나 원문을 붙여넣어 주세요. 원문이 없으면 추출 실패로 표시합니다.</p>}
        <div className="item-field"><label htmlFor="source-author">출처 작성자</label><input id="source-author" name="author" value={fields.author} onChange={(e) => change("author", e.target.value)} maxLength={200} /></div>
        <div className="item-field"><label htmlFor="raw-text">원문</label><textarea id="raw-text" name="rawText" value={fields.rawText} onChange={(e) => change("rawText", e.target.value)} rows={8} maxLength={50000} /></div>
        <button type="button" className="soft-button" onClick={normalize} disabled={!fields.rawText.trim()}>원문에서 후보 정리</button>
        {draft.truncated && <p role="alert">재료·단계 후보는 각각 처음 100개까지만 정리해요. 전체 원문은 보존하며, 나머지는 별도 항목으로 나누어 저장해 주세요.</p>}
        <EvidencePanel evidence={draft.evidence} />
        <h2>정리 결과 · 저장 전 확인</h2>
        <div className="item-field"><label htmlFor="item-title">제목</label><input id="item-title" name="title" value={fields.title} onChange={(e) => change("title", e.target.value)} required maxLength={200} autoComplete="off" /></div>
        <div className="item-field"><label htmlFor="item-summary">요약</label><textarea id="item-summary" name="summary" value={fields.summary} onChange={(e) => change("summary", e.target.value)} rows={2} maxLength={1000} /></div>
        <div className="item-field"><label htmlFor="item-body">본문</label><textarea id="item-body" name="body" value={fields.body} onChange={(e) => change("body", e.target.value)} rows={10} maxLength={50000} /></div>
        <div className="item-field"><label htmlFor="recipe-ingredients">재료와 분량</label><textarea id="recipe-ingredients" name="ingredients" value={fields.ingredients} onChange={(e) => change("ingredients", e.target.value)} rows={5} maxLength={50000} aria-describedby="ingredients-help" /><p id="ingredients-help" className="muted">한 줄에 하나씩 이름 | 분량. 예: 고구마 | 200g. 분량을 모르면 이름만 적어 주세요.</p></div>
        <div className="item-field"><label htmlFor="recipe-steps">조리 단계</label><textarea id="recipe-steps" name="steps" value={fields.steps} onChange={(e) => change("steps", e.target.value)} rows={5} maxLength={50000} aria-describedby="steps-help" /><p id="steps-help" className="muted">한 줄에 한 단계씩 내용 | 시간 | 온도. 모르는 시간·온도는 비워 두세요.</p></div>
        {Object.entries(recipeFields).map(([key, label]) => <div className="item-field" key={key}><label htmlFor={`recipe-${key}`}>{label}</label><textarea id={`recipe-${key}`} name={key} value={fields[key as keyof typeof recipeFields]} onChange={(e) => change(key as keyof typeof fields, e.target.value)} rows={key === "tips" ? 3 : 1} maxLength={key === "tips" ? 10000 : 1000} placeholder="미기재" /></div>)}
        <div className="item-field"><label htmlFor="item-notes">메모</label><textarea id="item-notes" name="notes" value={fields.notes} onChange={(e) => change("notes", e.target.value)} rows={3} maxLength={10000} /></div>
        <div className="item-field"><label htmlFor="item-tags">태그</label><input id="item-tags" name="tags" value={fields.tags} onChange={(e) => change("tags", e.target.value)} aria-describedby="tag-help" /></div>
        <p id="tag-help" className="muted">쉼표로 구분해 주세요. 예: 간식, 다시 만들기 · 최대 20개</p>
      </fieldset>
      {warning && <p role="status" className="muted">{warning}</p>}
      {state.error && <p role="alert" className="auth-message">{state.error}</p>}
      <div className="library-toolbar"><button className="auth-button" disabled={pending || Boolean(state.saved)}>{pending || state.saved ? "저장 중…" : "저장하기"}</button><Link href={id ? `/items/${id}` : "/items"}>취소</Link></div>
    </form>
  );
}
