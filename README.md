# 차곡

**발견한 정보를 차곡차곡.**

흩어진 링크와 메모를 한곳에 모아, 다시 찾기 쉬운 정보로 정리하는 개인용 모바일 웹서비스입니다.

![차곡 화면 콘셉트](docs/assets/chagok-concept.png)

_현재 개발 중인 제품 콘셉트입니다. 화면 이미지는 방향을 보여주는 시안이며, 실제 추출 결과를 보장하지 않습니다._

## 차곡은 무엇을 해결하나요?

좋아 보이는 레시피와 정보를 SNS에 저장해두고도 나중에 다시 찾지 못하는 문제에서 시작했습니다.

차곡은 링크, 텍스트, 직접 작성한 내용을 개인 보관함에 저장하고, 제목·본문·태그·출처로 다시 찾아볼 수 있게 합니다. 첫 번째 정보 유형은 요리·베이킹 레시피지만, 이후 러닝 팁·AI 활용법·일반 정보로 확장할 수 있는 구조를 사용합니다.

## 지금 만들고 있는 것

| 영역 | MVP 방향 |
| --- | --- |
| 입력 | 링크 가져오기, 텍스트 붙여넣기, 직접 작성 |
| 정리 | 설명 가능한 규칙 기반 후보 정리 |
| 보관 | 사용자별 비공개 보관함, 검색, 태그, 즐겨찾기 |
| 출처 | 원본 URL, 작성자, 원문 근거, 미확인 값 구분 |
| 인증 | Google 로그인, 초기 허용 계정 |
| 비용 | 무료 우선, MVP에는 AI 호출·광고·결제 없음 |

원문에 없는 재료 분량·시간·온도를 그럴듯하게 채우지 않습니다. 수집이 실패하면 실패 이유를 보여주고 캡션 붙여넣기, 참고 파일 첨부, 직접 작성으로 이어갑니다.

## 제품 원칙

- **정확하게:** 미기재, 추출 실패, 충돌을 서로 다르게 표시합니다.
- **차곡답게:** 장식보다 읽기와 다시 찾기를 우선합니다.
- **비공개로:** 사용자 데이터와 첨부 파일은 기본적으로 소유자만 봅니다.
- **무료부터:** 본인이 매주 쓰는 도구가 되는 것을 첫 성공 기준으로 삼습니다.
- **확장 가능하게:** 공통 정보 항목 위에 레시피 같은 유형별 내용을 얹습니다.

## 기술 방향

- **Web:** Next.js App Router + TypeScript
- **Auth / DB / Files:** Supabase Auth, PostgreSQL, Storage
- **Deploy:** Vercel + GitHub
- **Testing:** Vitest, Playwright
- **AI:** MVP 이후 선택 기능. 광고 시청으로 AI 분석 1회 이용권을 제공하는 방식을 검증 예정

모든 개인 데이터 테이블은 사용자 ID 기반 PostgreSQL RLS를 사용합니다. Storage는 비공개 버킷으로 운영하고, 비밀키는 저장소와 클라이언트 번들에 넣지 않습니다.

## 로컬 실행

> 현재 저장소의 첫 앱 스캐폴드는 PR [#11](https://github.com/JIHYE0705/chagok/pull/11)에서 준비 중입니다. PR 병합 후 아래 명령으로 실행할 수 있습니다.

```bash
npm ci
npm run dev
```

개발 서버: `http://localhost:3000`

### 검증

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run test:e2e
```

Playwright Chromium이 없다면 한 번만 설치합니다.

```bash
npx playwright install chromium
```

Supabase와 Google OAuth가 연결되기 전까지는 앱 환경 변수가 필요하지 않습니다. 비밀값은 절대 `.env`나 GitHub에 커밋하지 않습니다.

## 개발 흐름

개발 작업은 항상 GitHub 이슈에서 시작합니다.

```text
이슈 → 기능 브랜치 → 테스트 우선 구현 → 로컬 실측 → PR → CI → main 병합 → 자동 배포
```

현재 주요 이슈:

- [#2 앱 스캐폴드](https://github.com/JIHYE0705/chagok/issues/2)
- [#3 Supabase 스키마와 RLS](https://github.com/JIHYE0705/chagok/issues/3)
- [#4 Google 로그인](https://github.com/JIHYE0705/chagok/issues/4)
- [#5 보관함·태그·검색](https://github.com/JIHYE0705/chagok/issues/5)
- [#6 직접 추가와 규칙 기반 정리](https://github.com/JIHYE0705/chagok/issues/6)
- [#7 안전한 링크 수집](https://github.com/JIHYE0705/chagok/issues/7)
- [#8 비공개 첨부 파일](https://github.com/JIHYE0705/chagok/issues/8)
- [#9 PR CI와 main 자동 배포](https://github.com/JIHYE0705/chagok/issues/9)
- [#10 개발 의존성 보안 감사](https://github.com/JIHYE0705/chagok/issues/10)

## 로드맵

### 지금 — 무료 MVP

- [ ] 모바일 우선 앱 셸과 Google 로그인
- [ ] 사용자별 RLS와 비공개 Storage
- [ ] 직접 작성·텍스트 붙여넣기·링크 메타데이터
- [ ] 보관함·검색·태그·즐겨찾기
- [ ] 누락·충돌·접근 실패를 정직하게 표시

### 다음 — 사용성 검증

- [ ] 본인 실사용과 모바일·PC 재접속 검증
- [ ] 소규모 초대 사용자 테스트
- [ ] 반복 저장과 재방문 패턴 확인
- [ ] 정보 유형 확장 시나리오 검증

### 나중 — 비용이 정당화될 때

- [ ] 브라우저 로컬 AI 가능성 실험
- [ ] 광고 시청 기반 AI 분석 이용권
- [ ] 공개 가입 제어
- [ ] Kakao 로그인

## 문서

- [제품 설계](docs/superpowers/specs/2026-10-09-chagok-free-first-design.md)
- [MVP 구현 계획](docs/superpowers/plans/2026-10-09-chagok-mvp-implementation.md)
- [화면 콘셉트 원본](docs/assets/chagok-concept.png)

## 라이선스

아직 초기 개발 단계입니다. 공개 범위와 라이선스는 배포 전 확정합니다.
