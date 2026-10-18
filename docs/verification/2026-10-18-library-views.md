# 보관함 보기 전환·나눔스퀘어라운드·로고

관련: #34, PR #36. 2026-10-18.

## 적용 범위

- 동일한 항목을 카드형/목록형으로 전환한다. 기존 Server Component 항목과 검색·태그·즐겨찾기·페이지 처리를 재사용하며 별도 조회나 새 DB 구조를 만들지 않았다.
- `chagok-library-view` 레이아웃 전용 쿠키의 `cards`/`list`만 읽는다. 값이 없거나 다른 값이면 카드형이다. Path=/, Max-Age 1년, SameSite=Lax, HTTPS에서는 Secure. 권한이나 사용자 데이터의 근거로 사용하지 않는다.
- 서버가 쿠키를 읽어 첫 화면부터 선택된 뷰로 렌더링한다. 브라우저 저장이 차단되면 그 화면에서는 선택이 동작하고 다음 방문의 기억은 보장하지 않는다. 계정별/기기 간 동기화는 없다.
- 나눔스퀘어라운드 400/700을 `next/font/local`로 제공한다. 외부 폰트 CDN 요청은 하지 않는다. 기존 고운돋움은 시안 비교 자산으로만 남았다.
- 사진 없는 카드에는 기존 노트 캐릭터를 쓰고 목록에서는 큰 기본 표지를 숨긴다. 실제 사진은 두 뷰 모두 비공개 표지 경로로 표시한다.
- 긴 목록 제목의 표시는 두 줄로 제한한다. 상세·수정용 원본 제목은 자르지 않는다.
- ‘차곡’ SVG 워드마크를 직접 그리고 안내 첫 화면·보관함 헤더·시안에 적용했다. 본문 글꼴과 별개이며 alt/접근 가능한 이름은 ‘차곡’이다.

## 폰트 출처와 파일

공식 소개: https://m-hangeul.naver.com/font/detail/nanum-square-round

공식 배포 CSS: https://hangeul.pstatic.net/hangeul_static/css/nanum-square-round.css

공식 라이선스: https://help.naver.com/service/30016/contents/18088?osType=PC&lang=ko

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| NanumSquareRound-Regular.woff2 | 247228 | 3127eb6b4cf10a0a840d204d613f610bbbd7f8a7ce82c0f81d04713760f81758 |
| NanumSquareRound-Bold.woff2 | 232072 | 4e8692a08d6c323f1bffb3641c7276d9c4bc8fa2891d78b02acc972776228600 |

두 파일은 공식 WOFF2를 그대로 저장했고 글리프·내부 이름·디자인을 수정하지 않았다. NAVER의 저작권 및 Reserved Font Name 안내와 SIL OFL 1.1은 `app/fonts/NanumSquareRound-OFL.txt`에 동봉했다. 파일 합계는 479,300바이트이며, HTTP 전송 크기나 실제 LCP/CLS 측정값이 아니다. 공식 안내의 한글 2,350자 범위 밖 문자는 시스템 Sans로 대체될 수 있다.

## 실행한 검증

- 단위 테스트 105개 통과. 새 LibraryView 테스트는 서버가 정한 첫 뷰, 선택 변경 중 내용 유지, 쿠키 기록, 쿠키 차단 시 전환, 기본 카드형을 확인한다.
- typecheck·lint·production build 통과. 초기 테스트의 createElement props/children 타입 및 lint 오류를 수정하고 재확인했다.
- 실제 연결 Supabase에서 임시 Auth/소유 항목을 사용한 보관함 E2E 4개와 공개 첫 화면 E2E 1개 통과. Google OAuth 제공자 왕복을 자동화한 것은 아니다. 테스트 계정·소유 데이터·파일은 기존 fixture 정리 절차로 삭제한다.
- 기존 저장/검색/태그/즐겨찾기/수정/삭제, 검증 실패 시 입력 보존, 타 소유자 접근 거부 확인.
- 목록형 선택 후 새로고침 응답 HTML부터 `data-view="list"`인 것을 확인. 키보드 Space로 카드형 전환 후 URL·검색어·즐겨찾기 필터가 유지되는 것 확인.
- 긴 제목·단위가 포함된 예시와 사진 없는 항목을 카드형/목록형 × 320/390/768/1440px의 8개 조합에서 확인. 가로 넘침 없음. 상세에서는 전체 제목 확인.
- 유효한 **1px PNG 테스트 파일**을 실제 private Storage에 업로드·대표 지정하고 두 뷰에서 디코딩·표시되는 것을 확인. 실제 음식 사진이나 외부 SNS 게시물을 새로 검증한 것은 아니다.
- FontFaceSet에서 나눔스퀘어라운드 로딩 완료, 실제 보관함에서 외부 font 요청이 없는 것 확인. 시안에서도 동일 파일 로딩을 확인했다.
- [실제 앱 카드형 320px](assets/library-views/library-cards-320.png) · [목록형 320px](assets/library-views/library-list-320.png) · [카드형 PC](assets/library-views/library-cards-1440.png) · [목록형 PC](assets/library-views/library-list-1440.png). 테스트 계정의 예시 데이터와 테스트 PNG를 사용한 캡처다.

## 남은 검증 및 범위

- 로고 수정 후 공개 첫 화면과 실제 연결 표지·두 뷰의 320px~PC 시나리오 2개를 재실행해 통과했다. PR CI 결과는 전달 시 별도로 확인한다. 로고의 시각적 최종 확정은 아직 받지 않았다.
- 실제 기기·스크린리더·브라우저 확대·느린 네트워크의 폰트 로딩과 CLS/LCP는 측정하지 않았다. 로컬 폰트나 서버의 뷰 복원이 성능 검증 전체를 대신하지 않는다.
- 실제 Google 로그인 왕복, 외부 SNS 수집과 실제 사진 선택의 전체 회귀 검사는 이번 변경에서 새로 수행하지 않았다.
- DB 스키마/RPC/RLS/Storage 정책은 변경하지 않았다. 연결 DB pgTAP를 다시 실행하지 않았고, CI의 Linked Supabase DB/Preview skipped 상태를 검증 성공으로 취급하지 않는다.
- 전체 화면의 UI 재설계와 #34의 모든 완료 조건은 별도 잔여 작업이다. 현재 완료 범위는 두 가지 보기 방식, 앱 기본 Sans 글꼴, 공통 로고와 관련 보관함 표시다.
