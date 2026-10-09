import Link from "next/link";
import { signIn, signOut } from "../auth/actions";
import { SubmitButton } from "./submit-button";

const messages: Record<string, string> = {
  config: "로그인 준비 중이에요. 잠시 후 다시 방문해 주세요.",
  session: "로그인이 필요하거나 세션이 만료됐어요. 다시 로그인해 주세요.",
  denied: "아직 초대되지 않은 계정이에요. 초대받은 Google 계정으로 다시 로그인해 주세요.",
  callback: "로그인을 완료하지 못했어요. 다시 시도해 주세요.",
  unavailable: "로그인 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
  signout: "로그아웃을 완료하지 못했어요. 다시 시도해 주세요.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;
  const configured = Boolean(process.env.APP_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const message = !configured ? messages.config : typeof error === "string" && Object.hasOwn(messages, error) ? messages[error] : null;
  return (
    <main className="app-shell" data-testid="app-shell">
      <section className="welcome-card auth-card" aria-labelledby="login-title">
        <Link className="wordmark" href="/">차곡 · 나의 작은 정보 보관함</Link>
        <div className="auth-intro">
          <p className="eyebrow">나만의 기록을 만나러</p>
          <h1 id="login-title">차곡에 오신 걸<br />환영해요.</h1>
          <p className="welcome-copy">Google 계정으로 로그인하고<br />소중한 발견을 차곡차곡 모아 보세요.</p>
        </div>
        {message && <p className="auth-message" role="alert">{message}</p>}
        {configured && (error === "signout" ? (
          <form action={signOut}><SubmitButton pending="로그아웃 중…">로그아웃 다시 시도</SubmitButton></form>
        ) : (
          <form action={signIn}><SubmitButton pending="Google로 이동 중…">Google로 로그인</SubmitButton></form>
        ))}
        <p className="welcome-copy">지금은 초대받은 계정만 이용할 수 있어요.<br />내 기록은 나만 볼 수 있어요.</p>
      </section>
    </main>
  );
}
