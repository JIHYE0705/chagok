# 차곡 무료 우선 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 무료 운영비를 우선한 다중 사용자 차곡 MVP를 만들어 사용자가 링크·텍스트·직접 작성으로 정보를 저장하고, 태그와 검색으로 다시 찾게 한다.

**Architecture:** Next.js App Router가 화면과 Route Handler를 제공하고, Supabase Auth·Postgres·Storage가 인증·영구 데이터·비공개 파일을 담당한다. 공통 `items` 모델 위에 레시피 전용 테이블을 얹고, 규칙 기반 정리기는 순수 함수로 분리한다. 초기에는 AI 호출·광고·결제를 구현하지 않으며, 향후 제공자를 꽂을 인터페이스만 둔다.

**Tech Stack:** TypeScript, Next.js App Router, Supabase Auth/Postgres/Storage, Vitest, Playwright, npm, Vercel

**Spec:** `docs/superpowers/specs/2026-10-09-chagok-free-first-design.md`

## Global Constraints

- MVP는 수동 작성, 텍스트 붙여넣기, 링크 메타데이터 수집을 제공한다.
- 규칙 기반 정리만 자동화한다. 원문에 없는 분량·시간·온도는 만들지 않는다.
- Google 로그인만 구현하고, 초기에는 허용된 계정만 접근한다.
- 모든 사용자의 데이터와 Storage 파일은 기본 비공개다.
- 모든 공통·유형별·연결 테이블에 `user_id` 기반 PostgreSQL RLS를 적용한다.
- MVP에는 광고, 결제, OpenAI API 호출, Kakao 로그인, 챗봇, 커뮤니티를 넣지 않는다.
- 외부 콘텐츠의 명령문은 데이터로만 취급한다.
- API 키·서비스 키·개인 원문은 클라이언트 번들, GitHub, 로그에 남기지 않는다.
- 완료되지 않은 작업은 완료로 표시하지 않으며, 수집 실패·누락·충돌을 성공처럼 표시하지 않는다.
- 정보 항목 중심의 공통 모델과 유형별 세부 모델을 사용하고 사용자 정의 태그의 다대다 연결을 지원한다.
- 개발은 기능 브랜치에서 수행하고, 로컬 실측·검증을 마친 뒤 PR로 병합한다.
- PR에서는 CI 검사를 통과해야 하며, `main` 병합 후 Vercel이 자동으로 배포한다.

## Review Focus

- 다른 사용자의 `item`, 태그, 첨부 파일을 추측한 ID로 읽거나 수정하는 요청은 모두 거부되어야 한다. → Task 2 RLS 통합 테스트
- 비로그인·허용 목록 밖 Google 계정·만료 세션은 보호된 화면과 Route Handler에 접근할 수 없어야 한다. → Task 3 인증 E2E 테스트
- 악성 URL, 내부 주소, 허용되지 않은 프로토콜과 리디렉션은 수집기에 도달하기 전에 차단되어야 한다. → Task 6 URL 안전성 테스트
- 원문에 분량이 없거나 서로 다른 값이 있을 때 결과는 추측하지 않고 `미기재`·`확인 필요`와 근거를 보존해야 한다. → Task 5 정규화 테스트
- 큰 파일·잘못된 MIME·중복 제출·네트워크 재시도에서 데이터가 노출되거나 중복 항목이 생기지 않아야 한다. → Task 7 업로드·멱등성 테스트

## File Map

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`
- Create: `app/`, `components/`, `lib/auth/`, `lib/data/`, `lib/normalizers/`, `lib/extractors/`, `lib/rules/`, `lib/ai/`
- Create: `supabase/migrations/`, `supabase/tests/`, `tests/unit/`, `tests/e2e/`
- Modify: `README.md` with local setup, environment variables, and verification commands

## Issue Mapping

Each task below becomes one GitHub development issue before implementation.

1. `✨ feat: scaffold Next.js app and test harness`
2. `🔐 feat: add Supabase schema and RLS isolation`
3. `🔑 feat: add Google auth and protected app shell`
4. `📚 feat: add items, tags, search, and favorites`
5. `🧹 feat: add manual capture and rule-based normalization`
6. `🔗 feat: add safe link metadata extraction and failure states`
7. `📎 feat: add private attachments and idempotent saves`
8. `🚀 feat: deploy and verify mobile cross-device MVP`

---

### Task 1: Scaffold Next.js App and Test Harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `vitest.config.ts`, `playwright.config.ts`, `tests/unit/smoke.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: runnable `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` commands; a responsive root layout for later tasks.

- [ ] **Step 1: Write the failing smoke test** asserting the root render contract and a stable `data-testid="app-shell"` marker.
- [ ] **Step 2: Run `npm test -- --run tests/unit/smoke.test.ts` and confirm it fails because the app is not scaffolded.**
- [ ] **Step 3: Create the Next.js TypeScript App Router scaffold, Korean-first metadata, CSS tokens for the milk-white/pastel palette, and the test scripts.** Keep dependencies limited to the selected stack.
- [ ] **Step 4: Run `npm test -- --run`, `npm run lint`, `npm run typecheck`, and `npm run build`; all must pass.
- [ ] **Step 5: Commit with `✨ feat: scaffold Next.js app and test harness`.**

### Task 2: Supabase Schema and RLS Isolation

**Files:**
- Create: `supabase/migrations/0001_core_schema.sql`
- Create: `supabase/migrations/0002_rls_policies.sql`
- Create: `supabase/tests/rls.sql`
- Create: `lib/data/types.ts`, `lib/data/supabase-server.ts`
- Modify: `README.md` with Supabase local setup

**Interfaces:**
- Produces: tables `profiles`, `access_allowlist`, `items`, `item_contents`, `sources`, `source_evidence`, `attachments`, `tags`, `item_tags`, `processing_jobs`, `recipe_details`, `ingredients`, and `recipe_steps`; RLS policies keyed by `auth.uid()`; typed row contracts consumed by later tasks.

- [ ] **Step 1: Write SQL policy tests for authenticated owner allow, authenticated non-owner deny, and anonymous deny on every exposed table and Storage object operation.**
- [ ] **Step 2: Run `supabase test db` and confirm the new policy tests fail before migrations exist.**
- [ ] **Step 3: Implement the normalized schema, indexes for `user_id`, `updated_at`, `type`, and search fields, foreign keys with safe delete behavior, and RLS/grants with least privilege.** Keep the initial allowlist protected from client writes.
- [ ] **Step 4: Add the server Supabase client using cookie-backed sessions; never expose a service key to client modules.
- [ ] **Step 5: Run `supabase test db`, migration checks, and TypeScript checks; confirm all owner/non-owner/anonymous cases pass.
- [ ] **Step 6: Commit with `🔐 feat: add Supabase schema and RLS isolation`.**

### Task 3: Google Auth and Protected App Shell

**Files:**
- Create: `lib/auth/supabase-browser.ts`, `lib/auth/supabase-middleware.ts`
- Create: `app/login/page.tsx`, `app/auth/callback/route.ts`, `app/(protected)/layout.tsx`
- Create: `app/(protected)/page.tsx`
- Create: `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: Task 2 session client and `profiles`/`access_allowlist` tables.
- Produces: `getCurrentUser(): Promise<User | null>`, protected route behavior, and a Google OAuth callback that accepts only an allowlisted account.

- [ ] **Step 1: Write E2E cases for signed-out redirect, allowlisted Google session, non-allowlisted rejection, and expired-session redirect.**
- [ ] **Step 2: Run `npm run test:e2e -- tests/e2e/auth.spec.ts` and confirm the cases fail without auth routes.
- [ ] **Step 3: Implement cookie-backed Supabase SSR auth, Google sign-in, callback exchange, allowlist check, sign-out, and protected layout redirects.
- [ ] **Step 4: Add an accessible login/error/loading UI; do not log tokens or profile payloads.
- [ ] **Step 5: Run auth E2E tests with local Supabase fixtures and `npm run typecheck`; confirm protected routes never render private data while signed out.
- [ ] **Step 6: Commit with `🔑 feat: add Google auth and protected app shell`.**

### Task 4: Items, Tags, Search, and Favorites

**Files:**
- Create: `lib/data/items.ts`, `lib/data/tags.ts`, `lib/data/search.ts`
- Create: `components/item-card.tsx`, `components/tag-chip.tsx`, `components/search-bar.tsx`, `components/filter-bar.tsx`
- Create: `app/(protected)/items/page.tsx`, `app/(protected)/items/[id]/page.tsx`
- Create: `tests/unit/items.test.ts`, `tests/e2e/library.spec.ts`

**Interfaces:**
- Consumes: Task 2 typed rows and Task 3 current-user boundary.
- Produces: `listItems(input): Promise<ItemList>`, `getItem(id): Promise<ItemDetail | null>`, `createItem(input): Promise<ItemDetail>`, `updateItem(id, patch): Promise<ItemDetail>`, `deleteItem(id): Promise<void>`, `listTags(): Promise<Tag[]>`, `upsertTag(name): Promise<Tag>`, and `toggleFavorite(id): Promise<boolean>`.

- [ ] **Step 1: Write unit tests for owner-scoped CRUD, tag deduplication, favorite toggling, recent-first ordering, and search across title/body/tag/type-specific text.
- [ ] **Step 2: Write E2E tests for empty library, search, tag filter, favorite filter, detail navigation, edit, and confirmed delete.
- [ ] **Step 3: Run the focused tests and confirm failures before data functions and screens exist.
- [ ] **Step 4: Implement server-side data functions that scope every query to the current user and use parameterized filters.
- [ ] **Step 5: Implement responsive library/detail UI with empty, loading, error, and optimistic-free save states; preserve server truth after mutations.
- [ ] **Step 6: Run unit, E2E, lint, typecheck, and build checks; confirm no private row is rendered in a cross-user fixture.
- [ ] **Step 7: Commit with `📚 feat: add items, tags, search, and favorites`.**

### Task 5: Manual Capture and Rule-Based Normalization

**Files:**
- Create: `lib/normalizers/normalize-item.ts`, `lib/rules/recipe-rules.ts`, `lib/normalizers/parse-source.ts`
- Create: `lib/ai/provider.ts` with an unused `AiProvider` interface
- Create: `components/capture-mode-switcher.tsx`, `components/item-editor.tsx`, `components/evidence-panel.tsx`
- Create: `app/(protected)/capture/page.tsx`, `app/(protected)/capture/review/page.tsx`
- Create: `tests/unit/normalize-item.test.ts`, `tests/e2e/capture.spec.ts`

**Interfaces:**
- Produces: `normalizeItem(input: RawItemInput): NormalizedItem`, `detectIngredientCandidates(text): Candidate[]`, `detectStepCandidates(text): Candidate[]`, and `AiProvider.analyze(input): Promise<AnalysisResult>` as an unimplemented future boundary that is never called by MVP routes.

- [ ] **Step 1: Write unit tests for title candidates, numbered steps, ingredient headings, whitespace cleanup, `미기재`, `추출 실패`, and `확인 필요` provenance.
- [ ] **Step 2: Run the focused unit tests and confirm they fail before normalizers exist.
- [ ] **Step 3: Implement pure normalization/rule functions with no network or database access; preserve source text and never infer missing quantities, times, temperatures, or servings.
- [ ] **Step 4: Write E2E tests for link/text/manual mode selection, editable draft fields, tag creation, discard protection, save success, and network retry preserving input.
- [ ] **Step 5: Implement the capture and review screens using the Task 4 create/update interfaces; mark generated candidates as editable drafts.
- [ ] **Step 6: Run unit/E2E checks with the sweet-potato example and assert quantities and preheating remain unconfirmed exactly as entered.
- [ ] **Step 7: Commit with `🧹 feat: add manual capture and rule-based normalization`.**

### Task 6: Safe Link Metadata Extraction and Failure States

**Files:**
- Create: `lib/extractors/url-policy.ts`, `lib/extractors/metadata.ts`
- Create: `app/api/extract/route.ts`
- Create: `components/extraction-status.tsx`
- Create: `tests/unit/url-policy.test.ts`, `tests/unit/metadata.test.ts`, `tests/e2e/link-capture.spec.ts`

**Interfaces:**
- Produces: `validateSourceUrl(value): ValidatedSourceUrl`, `extractMetadata(url): Promise<ExtractionResult>`, and `POST /api/extract` returning an explicit `success | partial | failed` result with safe metadata or a user-facing failure code.

- [ ] **Step 1: Write unit tests for allowed HTTPS YouTube/Instagram URLs, malformed URLs, non-HTTP protocols, localhost/private IPs, unsafe redirects, unsupported hosts, and duplicate canonical URLs.
- [ ] **Step 2: Run focused tests and confirm they fail before policy/extractor code exists.
- [ ] **Step 3: Implement URL validation and canonicalization before any outbound request; reject credentials, private destinations, unsupported protocols, and disallowed hosts.
- [ ] **Step 4: Implement bounded metadata fetching with timeout, response-size limit, content-type check, redirect revalidation, and explicit partial/failure results. Never scrape behind login or access restrictions.
- [ ] **Step 5: Add the Route Handler with idempotency key support and UI states for loading, partial metadata, failure fallback, and retry.
- [ ] **Step 6: Run security/unit/E2E checks and verify failed extraction never creates a completed item.
- [ ] **Step 7: Commit with `🔗 feat: add safe link metadata extraction and failure states`.**

### Task 7: Private Attachments and Idempotent Saves

**Files:**
- Create: `lib/data/attachments.ts`, `lib/storage/upload-policy.ts`
- Create: `components/attachment-picker.tsx`, `components/attachment-list.tsx`
- Create: `app/api/attachments/sign-upload/route.ts`
- Create: `tests/unit/upload-policy.test.ts`, `tests/e2e/attachments.spec.ts`

**Interfaces:**
- Produces: `validateUpload(file): UploadDecision`, `createSignedUpload(input): Promise<SignedUpload>`, `listAttachments(itemId): Promise<Attachment[]>`, and `deleteAttachment(id): Promise<void>` with owner-scoped policies.

- [ ] **Step 1: Write unit tests for allowed image/document MIME types, size/count limits, normalized safe paths, rejected executable content, and duplicate upload tokens.
- [ ] **Step 2: Write E2E tests for successful private upload, owner-only read/delete, rejected oversized/wrong-type file, and retry without duplicate attachment rows.
- [ ] **Step 3: Run focused tests and confirm they fail before the Storage policy and routes exist.
- [ ] **Step 4: Implement private bucket policies and server-issued signed upload/read URLs scoped to `{user_id}/{item_id}/...`; do not proxy large files through Vercel Functions.
- [ ] **Step 5: Implement client upload progress, retry, cancellation, metadata persistence, and cleanup on confirmed item deletion.
- [ ] **Step 6: Run Storage/RLS/E2E checks and verify file metadata never grants cross-user access.
- [ ] **Step 7: Commit with `📎 feat: add private attachments and idempotent saves`.**

### Task 8: Deploy and Verify Mobile Cross-Device MVP

**Files:**
- Create: `.env.example`, `vercel.json` only if a function setting is required
- Create: `.github/workflows/ci.yml`
- Create: `tests/e2e/deployed-smoke.spec.ts`
- Modify: `README.md` with local verification, PR, CI, and deployment checklist

**Interfaces:**
- Consumes: all previous tasks and their environment variable contracts.
- Produces: a GitHub PR CI workflow, a Vercel deployment linked to GitHub with production deploys from `main`, a repeatable preview/production verification command, and documented secret names without secret values.

- [ ] **Step 1: Write deployed smoke tests for Google login, save/search/edit from mobile viewport, PC re-login, and signed-out access denial.
- [ ] **Step 2: Run the local production build and manual mobile/desktop smoke pass; record the exact commands and expected results before changing deployment configuration.
- [ ] **Step 3: Implement `.github/workflows/ci.yml` to run lint, typecheck, unit tests, and build for pull requests and pushes to `main`; fail closed when a check fails.
- [ ] **Step 4: Configure Vercel Git integration so previews are created for PRs and production deploys happen only after changes land on `main`; configure Secret variables, Supabase OAuth callback URLs, redirect URLs, Storage policies, and the initial allowlist without committing credentials.
- [ ] **Step 5: Run CI locally and against a preview, then execute deployed smoke tests for Google login, save/search/edit from a mobile viewport, PC re-login, and signed-out access denial.
- [ ] **Step 6: Document the feature-branch → local verification → PR → CI → `main` merge → Vercel production flow and rollback notes in `README.md`.
- [ ] **Step 7: Commit with `🚀 feat: add CI and main-merge deployment verification`.**

## Future Issue Candidates (not MVP)

- `🤖 spike: evaluate browser-local AI normalization without server cost`
- `💰 spike: validate rewarded-ad economics for AI analysis credits`
- `🔓 feat: add public signup controls after private beta`
- `🌏 feat: add Kakao OAuth after Google-only MVP`
- `🧾 feat: add non-recipe item type and migration test`

## Verification Checklist

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test -- --run`
- [ ] `npm run build`
- [ ] `supabase test db`
- [ ] Local auth, RLS, extraction, attachment, and capture E2E suites
- [ ] Preview deployment smoke suite
- [ ] Mobile and desktop manual pass using the representative recipe
