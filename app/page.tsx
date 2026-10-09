export default function Home() {
  return (
    <main className="app-shell" data-testid="app-shell">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <p className="eyebrow">발견한 정보를 차곡차곡</p>
        <h1 id="welcome-title">차곡</h1>
        <p className="welcome-copy">작은 노트 보관함을 준비하고 있어요.</p>
      </section>
    </main>
  );
}
