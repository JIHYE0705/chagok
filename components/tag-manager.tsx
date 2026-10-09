"use client";

import { useActionState } from "react";
import { addTagAction, deleteTagAction } from "../app/(protected)/items/actions";

function TagDelete({ tag }: { tag: { id: string; name: string } }) {
  const [state, action, pending] = useActionState(deleteTagAction.bind(null, tag.id), { error: "" });
  return <details><summary>{tag.name}</summary><form action={action}><p>모든 항목에서 이 태그를 제거해요. 항목 내용은 유지돼요.</p><label className="check-label"><input type="checkbox" name="confirm" value="yes" required disabled={pending} />{tag.name} 삭제 확인</label><button className="soft-button" disabled={pending}>{pending ? "삭제 중…" : `${tag.name} 삭제`}</button>{state.error && <p role="alert">{state.error}</p>}</form></details>;
}

export function TagManager({ tags }: { tags: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addTagAction, { error: "" });
  return <details className="tag-manager"><summary>태그 관리</summary><form action={action} className="tag-create"><label>새 태그<input name="name" required maxLength={50} disabled={pending} /></label><button className="soft-button" disabled={pending}>{pending ? "추가 중…" : "태그 추가"}</button>{state.error && <p role="alert">{state.error}</p>}</form><div className="tag-list">{tags.map((tag) => <TagDelete key={tag.id} tag={tag} />)}</div></details>;
}
