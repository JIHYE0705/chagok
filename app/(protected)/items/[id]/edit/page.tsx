import { notFound } from "next/navigation";
import { getItem } from "../../../../../lib/data/items";
import { ItemForm } from "../../../../../components/item-form";

export default async function EditItem({ params }: { params: Promise<{ id: string }> }) {
  const item = await getItem((await params).id);
  if (!item) notFound();
  return <section className="auth-intro"><h1>항목 수정</h1><ItemForm id={item.id} initial={{ title: item.title, summary: item.summary, body: item.item_contents[0]?.body ?? "", notes: item.notes, tags: item.item_tags.flatMap(({ tags }) => tags ? [tags.name] : []) }} /></section>;
}
