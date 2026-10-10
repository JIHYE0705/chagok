import { notFound } from "next/navigation";
import { getItem } from "../../../../../lib/data/items";
import { ItemForm } from "../../../../../components/item-form";

export default async function EditItem({ params }: { params: Promise<{ id: string }> }) {
  const item = await getItem((await params).id);
  if (!item) notFound();
  const source = item.sources.toSorted((a, b) => a.created_at.localeCompare(b.created_at)).find((entry) => entry.kind !== "attachment");
  const recipe = item.recipe_details;
  return <section className="auth-intro"><h1>항목 수정</h1><ItemForm ownerId={item.user_id} id={item.id} initial={{ title: item.title, summary: item.summary, body: item.item_contents[0]?.body ?? "", notes: item.notes, tags: item.item_tags.flatMap(({ tags }) => tags ? [tags.name] : []), capture: {
    kind: source?.kind === "link" ? "link" : source?.kind === "text" ? "text" : "manual", sourceId: source?.id ?? "", url: source?.url ?? "", author: source?.author ?? "", rawText: item.item_contents[0]?.raw_text ?? "",
    servings: recipe?.servings_text ?? "", prepTime: recipe?.prep_time_text ?? "", cookTime: recipe?.cook_time_text ?? "", temperature: recipe?.temperature_text ?? "", tips: recipe?.tips ?? "",
    ingredients: recipe?.ingredients.toSorted((a, b) => a.position - b.position).map((entry) => ({ name: entry.name, quantity: entry.quantity_text ?? "" })) ?? [],
    steps: recipe?.recipe_steps.toSorted((a, b) => a.position - b.position).map((entry) => ({ instruction: entry.instruction, time: entry.time_text ?? "", temperature: entry.temperature_text ?? "" })) ?? [],
  }}} /></section>;
}
