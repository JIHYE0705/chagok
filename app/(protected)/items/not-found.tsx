import Link from "next/link";

export default function MissingItem() {
  return <section className="auth-intro"><h1>항목을 찾을 수 없어요</h1><p>삭제됐거나 접근할 수 없는 항목이에요.</p><Link href="/items">보관함으로 돌아가기</Link></section>;
}
