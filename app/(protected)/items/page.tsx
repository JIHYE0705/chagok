import { requireAppUser } from "../../../lib/auth/session";

export default async function Items() {
  await requireAppUser();
  return (
    <section className="auth-intro" aria-labelledby="items-title">
      <p className="eyebrow">좋은 발견이 나만의 기록이 되는 곳</p>
      <h1 id="items-title">나의 보관함</h1>
      <p className="welcome-copy">반가워요. 나만의 작은 보관함에 도착했어요.<br />정보 저장과 검색 기능은 곧 준비될 예정이에요.</p>
    </section>
  );
}
