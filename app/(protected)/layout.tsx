import Link from "next/link";
import { requireAppUser } from "../../lib/auth/session";
import { signOut } from "../auth/actions";
import { SubmitButton } from "../login/submit-button";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAppUser();
  return (
    <main className="app-shell" data-testid="app-shell">
      <div className="welcome-card">
        <header className="welcome-header">
          <Link className="wordmark" href="/items">차곡 · 나의 보관함</Link>
          <form action={signOut}><SubmitButton pending="로그아웃 중…">로그아웃</SubmitButton></form>
        </header>
        {children}
      </div>
    </main>
  );
}
