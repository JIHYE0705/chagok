import { evidenceLabels } from "../lib/normalizers/normalize-item";

export function EvidencePanel({ evidence }: { evidence: { field: string; excerpt: string | null; location: string | null; status: keyof typeof evidenceLabels }[] }) {
  return <details className="evidence-panel"><summary>원문 근거와 확인 상태</summary><p className="muted">자동 정리는 후보예요. 원문과 비교하고, 수정한 값은 직접 확인해 주세요.</p><ul>{evidence.map((entry, index) => <li key={index}><strong>{entry.field}</strong> · {evidenceLabels[entry.status]}{entry.location && ` · ${entry.location}`}{entry.excerpt && <blockquote className="preserve-lines">{entry.excerpt}</blockquote>}</li>)}</ul></details>;
}
