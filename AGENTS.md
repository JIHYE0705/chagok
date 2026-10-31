# GitHub PR 지침

- PR 생성 전 저장소의 기존 label을 확인하고 작업 목적·영역에 맞게 적용한 뒤 실제 적용 여부를 확인한다.
- 적절한 기존 label이 없으면 임의로 만들지 않고 PR 전달 시 알린다.

# 차곡 디자인 지침

- 브랜드는 **Little Joy, Well Organized**, 스타일은 **Playful Minimalism**이다. 정갈함 80%, 작은 즐거움 20%를 감각적 출발점으로 삼는다.
- 음식 사진과 레시피 정보, 읽기·검색·입력 경험을 우선한다. 캐릭터 반복, 과도한 파스텔·둥근 박스·스티커·바운스를 피한다.
- 세부 기준은 [디자인 시스템](docs/design/DESIGN_SYSTEM.md), 기존 승인과 변경 이유는 [결정 기록](docs/design/DECISIONS.md)을 따른다. 과거 #34 시안은 비교 기록이며 최신 기준을 우선한다.
- 색상은 의미 기반 토큰으로 관리하고 일반 텍스트·UI 상태의 WCAG AA 대비를 검증한다. Pretendard는 차기 기본 폰트 후보이며 현재 앱에 적용된 것으로 간주하지 않는다.
- 공통 컴포넌트와 기존 CSS 방식을 재사용한다. 디자인 작업으로 API·저장 형식·원문·출처·실패 상태·입력 보존을 바꾸지 않는다.
- 새 화면이나 대규모 리디자인은 방향 제안 후 승인된 범위에서 구현한다. 이번 브랜드 지침 작업은 문서·분석 단계이며 전체 UI 변경을 승인하지 않는다.
- UI 구현·검토에는 [chagok-ui-review](.agents/skills/chagok-ui-review/SKILL.md)를 사용한다. 320px부터 PC까지, 긴 한글·단위·사진 유무·키보드·오류 상태를 확인한다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
