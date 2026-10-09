"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveItemAction } from "../app/(protected)/items/actions";
import type { ItemInput } from "../lib/data/search";

export function ItemForm({ id = null, initial }: { id?: string | null; initial?: ItemInput }) {
  const [state, action, pending] = useActionState(saveItemAction.bind(null, id), { error: "" });
  const [fields, setFields] = useState({ title: initial?.title ?? "", summary: initial?.summary ?? "", body: initial?.body ?? "", notes: initial?.notes ?? "", tags: initial?.tags.join(", ") ?? "" });
  const change = (name: keyof typeof fields, value: string) => setFields((previous) => ({ ...previous, [name]: value }));
  return (
    <form action={action} className="item-form">
      <fieldset disabled={pending}>
        <div className="item-field"><label htmlFor="item-title">제목</label><input id="item-title" name="title" value={fields.title} onChange={(e) => change("title", e.target.value)} required maxLength={200} autoComplete="off" /></div>
        <div className="item-field"><label htmlFor="item-summary">요약</label><textarea id="item-summary" name="summary" value={fields.summary} onChange={(e) => change("summary", e.target.value)} rows={2} maxLength={1000} /></div>
        <div className="item-field"><label htmlFor="item-body">본문</label><textarea id="item-body" name="body" value={fields.body} onChange={(e) => change("body", e.target.value)} rows={10} maxLength={50000} /></div>
        <div className="item-field"><label htmlFor="item-notes">메모</label><textarea id="item-notes" name="notes" value={fields.notes} onChange={(e) => change("notes", e.target.value)} rows={3} maxLength={10000} /></div>
        <div className="item-field"><label htmlFor="item-tags">태그</label><input id="item-tags" name="tags" value={fields.tags} onChange={(e) => change("tags", e.target.value)} aria-describedby="tag-help" /></div>
        <p id="tag-help" className="muted">쉼표로 구분해 주세요. 예: 간식, 다시 만들기 · 최대 20개</p>
      </fieldset>
      {state.error && <p role="alert" className="auth-message">{state.error}</p>}
      <div className="library-toolbar"><button className="auth-button" disabled={pending}>{pending ? "저장 중…" : "저장하기"}</button><Link href={id ? `/items/${id}` : "/items"}>취소</Link></div>
    </form>
  );
}
