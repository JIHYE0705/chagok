"use client";

import Link from "next/link";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="app-shell">
      <section className="welcome-card auth-card" role="alert">
        <p>화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.</p>
        <button className="auth-button" onClick={reset}>다시 시도</button>
        <p><Link href="/login">로그인 화면으로 이동</Link></p>
      </section>
    </main>
  );
}
