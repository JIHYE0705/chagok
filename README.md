# 차곡

발견한 정보를 차곡차곡 모아두는 모바일 웹서비스입니다.

현재 저장소는 첫 번째 개발 이슈인 Next.js 앱 스캐폴드와 테스트 하네스를 담고 있습니다. 기능은 기능 브랜치에서 작업하고, 로컬 검증 후 PR로 병합합니다.

## 요구 환경

- Node.js `>=22.12.0`
- npm `>=11`

## 시작하기

```bash
npm ci
npm run dev
```

개발 서버는 `http://localhost:3000`에서 실행됩니다.

## 검증 명령

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run test:e2e
```

Playwright 브라우저가 없다면 한 번만 실행합니다.

```bash
npx playwright install chromium
```

아직 Supabase·Google OAuth·Storage 환경 변수는 연결되지 않았습니다. 기능이 추가되면 `.env.example`과 이 문서에 필요한 이름만 기록하고 비밀값은 커밋하지 않습니다.

## 작업 흐름

1. GitHub 이슈에서 작업 범위를 확인합니다.
2. 기능 브랜치를 만듭니다.
3. 테스트를 먼저 작성하고 로컬에서 실측합니다.
4. `lint`, `typecheck`, unit test, build를 확인합니다.
5. PR을 올리고 CI 통과 후 `main`에 병합합니다.
6. `main` 병합 후 Vercel이 배포합니다.

제품 설계와 구현 계획은 [`docs/superpowers/specs/2026-10-09-chagok-free-first-design.md`](docs/superpowers/specs/2026-10-09-chagok-free-first-design.md)와 [`docs/superpowers/plans/2026-10-09-chagok-mvp-implementation.md`](docs/superpowers/plans/2026-10-09-chagok-mvp-implementation.md)에 있습니다.
