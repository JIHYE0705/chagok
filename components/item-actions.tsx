"use client";

import { useActionState } from "react";
import { favoriteAction, deleteItemAction } from "../app/(protected)/items/actions";

export function FavoriteButton({ id, favorite }: { id: string; favorite: boolean }) {
  const [state, action, pending] = useActionState(favoriteAction.bind(null, id), { error: "" });
  return <form action={action}><button className="soft-button" aria-pressed={favorite} disabled={pending}>{pending ? "변경 중…" : favorite ? "★ 즐겨찾기 해제" : "☆ 즐겨찾기 추가"}</button>{state.error && <p role="alert">{state.error}</p>}</form>;
}

export function DeleteItem({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteItemAction.bind(null, id), { error: "" });
  return <details className="delete-panel"><summary>항목 삭제</summary><form action={action}><p>이 항목과 연결된 내용을 삭제해요. 삭제한 내용은 되돌릴 수 없어요.</p><label className="check-label"><input name="confirm" type="checkbox" value="yes" required disabled={pending} />삭제할 내용을 확인했어요</label><button className="soft-button" disabled={pending}>{pending ? "삭제 중…" : "삭제하기"}</button>{state.error && <p role="alert">{state.error}</p>}</form></details>;
}
