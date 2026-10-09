import Link from "next/link";
import type { listItems } from "../lib/data/items";
import { TagChip } from "./tag-chip";
import { FavoriteButton } from "./item-actions";

export function ItemCard({ item }: { item: Awaited<ReturnType<typeof listItems>>["items"][number] }) {
  return <article className="item-card"><p className="eyebrow">레시피 · {new Date(item.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</p><h2><Link href={`/items/${item.id}`}>{item.title}</Link></h2><p className="item-preview">{item.summary || "본문은 상세 화면에서 확인해요."}</p><div className="tag-list">{item.item_tags.map(({ tags }) => tags && <TagChip key={tags.id} tag={tags} />)}</div><FavoriteButton id={item.id} favorite={item.favorite} /></article>;
}
