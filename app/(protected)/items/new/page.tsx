import { ItemForm } from "../../../../components/item-form";
import { requireAppUser } from "../../../../lib/auth/session";

export default async function NewItem() {
  const user = await requireAppUser();
  return <section className="auth-intro"><p className="eyebrow">나만의 기록 한 장</p><h1>새 항목 저장</h1><p className="muted">확실히 알고 있는 내용만 적어 주세요. 빈 항목은 그대로 둘 수 있어요.</p><ItemForm ownerId={user.id} /></section>;
}
