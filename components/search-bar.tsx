import type { Filters } from "../lib/data/search";

export function SearchBar({ filters, tags }: { filters: Filters; tags: { id: string; name: string }[] }) {
  return <form action="/items" className="search-form"><label>보관함 검색<input type="search" name="q" defaultValue={filters.q} placeholder="제목, 본문, 태그, 재료 검색" maxLength={200} /></label><label>태그 필터<select name="tag" defaultValue={filters.tag}><option value="">모든 태그</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label><label className="check-label"><input type="checkbox" name="favorite" value="1" defaultChecked={filters.favorite} />즐겨찾기만</label><button className="auth-button">검색</button></form>;
}
