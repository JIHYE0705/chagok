"use client";
import Link from "next/link";

export default function LibraryError({ reset }: { reset: () => void }) {
  return <section className="auth-intro" role="alert"><h1>보관함을 열지 못했어요</h1><p>잠시 후 다시 시도해 주세요.</p><button className="auth-button" onClick={reset}>다시 시도</button><p><Link href="/items">보관함으로 돌아가기</Link></p></section>;
}
