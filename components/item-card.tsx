import { coverVersion } from "../lib/data/cover-selection";
import { ItemCover } from "./item-cover";
import Link from "next/link";
import type { listItems } from "../lib/data/items";
import { TagChip } from "./tag-chip";
import { FavoriteButton } from "./item-actions";

export function ItemCard({ item }: { item: Awaited<ReturnType<typeof listItems>>["items"][number] }) {
  return <article className="item-card">
    <ItemCover itemId={item.id} title={item.title} type={item.type} version={coverVersion(item.attachments, item.sources)} representative={item.attachments.some((file) => file.is_cover)} />
    <div className="item-card-content">
      <div className="item-card-top"><p className="eyebrow">레시피 · {new Date(item.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</p><FavoriteButton id={item.id} favorite={item.favorite} compact /></div>
      <h2><Link href={`/items/${item.id}`}>{item.title}</Link></h2>
      <p className="item-preview">{item.summary || "본문은 상세 화면에서 확인해요."}</p>
      <div className="tag-list">{item.item_tags.map(({ tags }) => tags && <TagChip key={tags.id} tag={tags} />)}</div>
    </div>
  </article>;
}
