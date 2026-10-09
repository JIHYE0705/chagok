import Image from "next/image";

export default function Home() {
  return (
    <main className="app-shell" data-testid="app-shell">
      <div className="welcome-card">
        <header className="welcome-header">
          <p className="wordmark">나의 작은 정보 보관함</p>
          <span className="status-badge">준비 중</span>
        </header>

        <section className="welcome-hero" aria-labelledby="welcome-title">
          <div className="welcome-intro">
            <p className="eyebrow">발견한 정보를 차곡차곡</p>
            <h1 id="welcome-title">차곡<span aria-hidden="true">.</span></h1>
            <p className="welcome-tagline">좋은 발견이<br />나만의 기록이 되는 곳.</p>
            <p className="welcome-copy">다시 만들고 싶은 레시피도,<br />잊고 싶지 않은 작은 팁도 한곳에.</p>
          </div>
          <div className="welcome-illustration" aria-hidden="true">
            <span className="note-label note-label-pink">나중에 꼭 만들어야지</span>
            <Image src="/chagok-note.svg" alt="" width={260} height={260} priority />
            <span className="note-label note-label-blue">이건 기억해 두자!</span>
          </div>
        </section>

        <ul className="welcome-features" aria-label="차곡이 준비하는 기능">
          <li>
            <span className="feature-icon feature-yellow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m10 13 4-4m-5 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" /></svg>
            </span>
            <h2>발견을 모으고</h2>
            <p>흩어진 링크를 한곳에</p>
          </li>
          <li>
            <span className="feature-icon feature-pink" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="15" height="18" rx="3" /><path d="M3 7h4M3 12h4M3 17h4m4-8h5m-5 4h5" /></svg>
            </span>
            <h2>내 말로 기록하고</h2>
            <p>작은 메모까지 함께</p>
          </li>
          <li>
            <span className="feature-icon feature-blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.8 5.6 6.2.9-4.5 4.4 1.1 6.1-5.6-3-5.6 3 1.1-6.1L3 9.5l6.2-.9Z" /></svg>
            </span>
            <h2>필요할 때 꺼내요</h2>
            <p>좋아하는 정보를 쉽게</p>
          </li>
        </ul>

        <footer className="welcome-footer">
          <span aria-hidden="true" className="status-dot" />
          작은 보관함을 준비하고 있어요. 곧 만나요!
        </footer>
      </div>
    </main>
  );
}
