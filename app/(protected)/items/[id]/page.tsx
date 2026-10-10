import Link from "next/link";
import { notFound } from "next/navigation";
import { getItem } from "../../../../lib/data/items";
import { FavoriteButton, DeleteItem } from "../../../../components/item-actions";
import { TagChip } from "../../../../components/tag-chip";
import { EvidencePanel } from "../../../../components/evidence-panel";
import type { evidenceLabels } from "../../../../lib/normalizers/normalize-item";

export default async function Item({ params }: { params: Promise<{ id: string }> }) {
  const item = await getItem((await params).id);
  if (!item) notFound();
  const recipe = item.recipe_details;
  return (
    <section className="auth-intro item-detail">
      <Link href="/items">← 보관함</Link>
      <p className="eyebrow">레시피</p>
      <h1>{item.title}</h1>
      <div className="library-toolbar">
        <FavoriteButton id={item.id} favorite={item.favorite} />
        <Link className="soft-button button-link" href={`/items/${item.id}/edit`}>수정하기</Link>
      </div>
      <div className="tag-list">
        {item.item_tags.map(({ tags }) => tags && <TagChip key={tags.id} tag={tags} />)}
      </div>
      {item.summary && <section><h2>요약</h2><p className="preserve-lines">{item.summary}</p></section>}
      <section>
        <h2>본문</h2>
        <p className="preserve-lines">{item.item_contents[0]?.body || "아직 본문이 없어요."}</p>
      </section>
      {recipe && (
        <section>
          <h2>레시피 정보</h2>
          <dl>
            {[
              ["인분", recipe.servings_text], ["준비 시간", recipe.prep_time_text],
              ["조리 시간", recipe.cook_time_text], ["온도", recipe.temperature_text],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "미기재"}</dd></div>)}
          </dl>
          {recipe.ingredients.length > 0 && (
            <>
              <h3>재료</h3>
              <ul>
                {recipe.ingredients.toSorted((a, b) => a.position - b.position).map((ingredient) => (
                  <li key={ingredient.id}>{ingredient.name} · {ingredient.quantity_text || "분량 미기재"}</li>
                ))}
              </ul>
            </>
          )}
          {recipe.recipe_steps.length > 0 && (
            <>
              <h3>조리 단계</h3>
              <ol>
                {recipe.recipe_steps.toSorted((a, b) => a.position - b.position).map((step) => (
                  <li key={step.id} className="preserve-lines">
                    {step.instruction}{step.time_text && ` · ${step.time_text}`}{step.temperature_text && ` · ${step.temperature_text}`}
                  </li>
                ))}
              </ol>
            </>
          )}
          {recipe.tips && <p className="preserve-lines">{recipe.tips}</p>}
        </section>
      )}
      {item.notes && <section><h2>메모</h2><p className="preserve-lines">{item.notes}</p></section>}
      {item.sources.map((source) => <section key={source.id}><h2>출처</h2><p>{({ manual: "직접 작성", text: "텍스트 붙여넣기", link: "링크", attachment: "첨부 파일" })[source.kind as "manual" | "text" | "link" | "attachment"]}{source.author && ` · ${source.author}`}</p>{source.url && /^https?:\/\//i.test(source.url) && <a href={source.url} target="_blank" rel="noopener noreferrer">원본 링크 열기</a>}<EvidencePanel evidence={source.source_evidence.map((entry) => ({ ...entry, status: entry.status as keyof typeof evidenceLabels }))} /></section>)}
      {item.item_contents[0]?.raw_text && <details className="evidence-panel"><summary>보존한 원문</summary><p className="preserve-lines">{item.item_contents[0].raw_text}</p></details>}
      <DeleteItem id={item.id} />
    </section>
  );
}
