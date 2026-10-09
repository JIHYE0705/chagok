import Link from "next/link";
import { listItems } from "../../../lib/data/items";
import { listTags } from "../../../lib/data/tags";
import { parseFilters, libraryUrl } from "../../../lib/data/search";
import { SearchBar } from "../../../components/search-bar";
import { ItemCard } from "../../../components/item-card";
import { TagManager } from "../../../components/tag-manager";

export default async function Items({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const [{ items, hasMore }, tags] = await Promise.all([listItems(filters), listTags()]);
  const filtered = Boolean(filters.q || filters.tag || filters.favorite || filters.page > 1);
  return (
    <section className="auth-intro" aria-labelledby="items-title">
      <p className="eyebrow">좋은 발견이 나만의 기록이 되는 곳</p>
      <h1 id="items-title">나의 보관함</h1>
      <div className="library-toolbar"><p className="welcome-copy">다시 꺼내 보고 싶은 발견을 차곡차곡 모아요.</p><Link className="auth-button button-link" href="/items/new">새 항목 저장</Link></div>
      <SearchBar key={libraryUrl(filters)} filters={filters} tags={tags} />
      <div className="library-toolbar"><p className="muted">최근 저장순</p>{filtered && <Link href="/items">필터 초기화</Link>}</div>
      {items.length ? <div className="item-grid">{items.map((item) => <ItemCard key={item.id} item={item} />)}</div> : <div className="empty-state"><h2>{filtered ? "검색 결과가 없어요" : "아직 보관한 항목이 없어요"}</h2><p>{filtered ? "검색어나 필터를 바꿔 보세요." : "첫 번째 레시피를 저장해 보세요."}</p><Link href={filtered ? "/items" : "/items/new"}>{filtered ? "전체 보관함 보기" : "새 항목 저장"}</Link></div>}
      <nav className="library-toolbar" aria-label="보관함 페이지">{filters.page > 1 && <Link href={libraryUrl(filters, filters.page - 1)}>이전 페이지</Link>}{hasMore && <Link href={libraryUrl(filters, filters.page + 1)}>다음 페이지</Link>}</nav>
      <TagManager tags={tags} />
    </section>
  );
}
