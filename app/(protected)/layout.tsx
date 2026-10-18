import Link from "next/link";
import Image from "next/image";
import { requireAppUser } from "../../lib/auth/session";
import { signOut } from "../auth/actions";
import { SubmitButton } from "../login/submit-button";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAppUser();
  return (
    <main className="app-shell protected-shell" data-testid="app-shell">
      <div className="welcome-card protected-card">
        <header className="welcome-header">
          <Link className="wordmark brand-mark" href="/items" aria-label="차곡 보관함"><Image className="brand-character" src="/chagok-note.svg" alt="" width={44} height={44} loading="eager" /><Image className="brand-wordmark" src="/chagok-wordmark.svg" alt="차곡" width={76} height={40} loading="eager" /></Link>
          <form action={signOut}><SubmitButton pending="로그아웃 중…">로그아웃</SubmitButton></form>
        </header>
        {children}
      </div>
    </main>
  );
}
