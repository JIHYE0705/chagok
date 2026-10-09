import Link from "next/link";

export function TagChip({ tag }: { tag: { id: string; name: string } }) {
  return <Link className="tag-chip" href={`/items?tag=${tag.id}`}>#{tag.name}</Link>;
}
