"use client";

import { useId, useState, type ReactNode } from "react";

type View = "cards" | "list";

export function LibraryView({ children, initialView = "cards" }: { children: ReactNode; initialView?: View }) {
  const [view, setView] = useState(initialView);
  const resultsId = useId();

  function choose(next: View) {
    setView(next);
    try { document.cookie = `chagok-library-view=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; }
    catch { /* The chosen layout still works when browser cookies are blocked. */ }
  }

  return <div className="library-results" data-view={view}>
    <div className="view-switcher" role="group" aria-label="보관함 보기 방식">
      <button type="button" className="soft-button" aria-pressed={view === "cards"} aria-controls={resultsId} onClick={() => choose("cards")}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="2" y="2" width="6" height="6" rx="1.2" /><rect x="12" y="2" width="6" height="6" rx="1.2" /><rect x="2" y="12" width="6" height="6" rx="1.2" /><rect x="12" y="12" width="6" height="6" rx="1.2" /></svg>
        카드형
      </button>
      <button type="button" className="soft-button" aria-pressed={view === "list"} aria-controls={resultsId} onClick={() => choose("list")}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="2" y="3" width="4" height="4" rx="1" /><path d="M10 5h8" /><rect x="2" y="13" width="4" height="4" rx="1" /><path d="M10 15h8" /></svg>
        목록형
      </button>
    </div>
    <div id={resultsId}>{children}</div>
  </div>;
}
