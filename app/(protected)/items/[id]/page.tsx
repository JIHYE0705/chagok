import { coverVersion } from "../../../../lib/data/cover-selection";
import { ItemCover } from "../../../../components/item-cover";
import { Attachments } from "../../../../components/attachments";
import { listAttachments } from "../../../../lib/data/attachments";
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
  const attachments = await listAttachments(item.id);
  const recipe = item.recipe_details;
  return (
    <section className="auth-intro item-detail" aria-labelledby="item-title">
      <Link className="detail-back" href="/items">← 보관함</Link>
      <div className="detail-overview">
        <header>
          <p className="eyebrow">레시피</p>
          <h1 id="item-title">{item.title}</h1>
          <div className="detail-actions">
            <FavoriteButton id={item.id} favorite={item.favorite} />
            <Link className="soft-button button-link" href={`/items/${item.id}/edit`}>수정하기</Link>
          </div>
          <div className="tag-list">
            {item.item_tags.map(({ tags }) => tags && <TagChip key={tags.id} tag={tags} />)}
          </div>
        </header>
        <ItemCover itemId={item.id} title={item.title} type={item.type} version={coverVersion(attachments, item.sources)} representative={attachments.some((file) => file.is_cover)} detail />
      </div>
      {item.sources.some((source) => source.collection_method === "metadata") && <p className="detail-collection-note">공개 제목·설명 메타데이터를 수집한 기록이 있어요. 재료와 조리 단계는 원문과 비교해 주세요.</p>}
      {recipe && <>
        <dl className="recipe-meta" aria-label="인분과 조리 조건">
          {[
            ["인분", recipe.servings_text], ["준비 시간", recipe.prep_time_text],
            ["조리 시간", recipe.cook_time_text], ["온도", recipe.temperature_text],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "미기재"}</dd></div>)}
        </dl>
        <div className="recipe-layout">
          <section className="recipe-ingredients" aria-labelledby="ingredients-title">
            <h2 id="ingredients-title">재료</h2>
            {recipe.ingredients.length ? <dl className="ingredient-list">
              {recipe.ingredients.toSorted((a, b) => a.position - b.position).map((ingredient) => (
                <div key={ingredient.id}><dt>{ingredient.name}</dt><dd className="preserve-lines">{ingredient.quantity_text || "분량 미기재"}</dd></div>
              ))}
            </dl> : <p className="muted">등록된 재료가 없어요.</p>}
          </section>
          <section className="recipe-instructions" aria-labelledby="instructions-title">
            <h2 id="instructions-title">조리 단계</h2>
            {recipe.recipe_steps.length ? <ol className="recipe-steps">
              {recipe.recipe_steps.toSorted((a, b) => a.position - b.position).map((step) => (
                <li key={step.id}>
                  <p className="preserve-lines">{step.instruction}</p>
                  {(step.time_text || step.temperature_text) && <p className="step-conditions">{step.time_text && <span>시간 {step.time_text}</span>}{step.temperature_text && <span>온도 {step.temperature_text}</span>}</p>}
                </li>
              ))}
            </ol> : <p className="muted">등록된 조리 단계가 없어요.</p>}
          </section>
        </div>
        {recipe.tips && <section className="detail-text"><h2>요리 팁</h2><p className="preserve-lines">{recipe.tips}</p></section>}
      </>}
      {item.summary && <section className="detail-text"><h2>요약</h2><p className="preserve-lines">{item.summary}</p></section>}
      <section className="detail-text">
        <h2>본문</h2>
        <p className="preserve-lines">{item.item_contents[0]?.body || "아직 본문이 없어요."}</p>
      </section>
      {item.notes && <section className="detail-text"><h2>메모</h2><p className="preserve-lines">{item.notes}</p></section>}
      {item.sources.map((source) => <section className="detail-source" key={source.id}><h2>출처</h2><p>{({ manual: "직접 작성", text: "텍스트 붙여넣기", link: "링크", attachment: "첨부 파일" })[source.kind as "manual" | "text" | "link" | "attachment"]}{source.author && ` · ${source.author}`}</p>{source.collection_method === "metadata" && <p className="muted">공개 제목·설명 메타데이터를 수집한 기록이에요. 레시피 본문 전체를 확인한 것은 아니에요.</p>}{source.url && /^https?:\/\//i.test(source.url) && <a className="detail-source-link" href={source.url} target="_blank" rel="noopener noreferrer">원본 링크 열기</a>}<EvidencePanel evidence={source.source_evidence.map((entry) => ({ ...entry, status: entry.status as keyof typeof evidenceLabels }))} /></section>)}
      {item.item_contents[0]?.raw_text && <details className="evidence-panel detail-raw"><summary>보존한 원문</summary><p className="preserve-lines">{item.item_contents[0].raw_text}</p></details>}
      <Attachments itemId={item.id} attachments={attachments} />
      <DeleteItem id={item.id} />
    </section>
  );
}
