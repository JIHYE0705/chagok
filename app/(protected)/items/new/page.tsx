import { ItemForm } from "../../../../components/item-form";
import { requireAppUser } from "../../../../lib/auth/session";

export default async function NewItem() {
  const user = await requireAppUser();
  return <section className="auth-intro"><h1>새 항목 저장</h1><p className="muted">원문을 가져오거나 직접 작성해 보관하세요. 모르는 분량·시간은 비워 두어도 괜찮아요.</p><ItemForm ownerId={user.id} /></section>;
}
