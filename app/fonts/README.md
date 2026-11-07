# 차곡의 글꼴

## Pretendard · 앱 기본 글꼴

- 공식 v1.3.9: https://github.com/orioncactus/pretendard/tree/v1.3.9/packages/pretendard/dist/web/static/woff2
- Regular/SemiBold WOFF2 원본을 변경 없이 제공한다. SIL OFL 1.1과 저작권 안내는 `Pretendard-OFL.txt`에 동봉했다.
- `next/font/local`로 400/600, `display: swap`, 자동 Arial fallback 보정과 시스템 Sans fallback을 사용한다. 두 굵기는 루트 레이아웃에서 preload되며 외부 폰트 요청은 없다.
- Regular 765,892 + SemiBold 785,856 = 1,551,748바이트. 비교한 가변 폰트 2,057,688바이트보다 작아 정적 두 파일을 선택했다. 기존 두 파일 합계 479,300바이트보다 커졌으므로 파일 크기 개선으로 보고하지 않는다.
- #43 시안과 앱이 이 파일을 공유한다. 실제 앱의 느린 로딩 검증 범위는 해당 검증 문서를 참고한다.

## 나눔스퀘어라운드 · 이전 앱/시안 비교용

- 공식 소개: https://m-hangeul.naver.com/font/detail/nanum-square-round
- 공식 배포 CSS: https://hangeul.pstatic.net/hangeul_static/css/nanum-square-round.css
- Regular/Bold WOFF2 원본을 그대로 동봉했다. 글리프·이름·디자인을 변경하지 않았다.
- 저작권: NAVER Corporation. SIL OFL 1.1 전문과 저작권/Reserved Font Name 안내는 `NanumSquareRound-OFL.txt`에 포함했다. 공식 라이선스 안내: https://help.naver.com/service/30016/contents/18088?osType=PC&lang=ko
- 과거 앱에서는 `next/font/local`로 400/700을 제공했다. 현재는 시안의 비교 선택에서만 로드한다. 공식 소개의 한글 지원 범위는 2,350자다.

## 고운돋움 · 이전 시안 비교용

- 공식 배포: https://github.com/google/fonts/tree/main/ofl/gowundodum
- 저작권 및 라이선스: 함께 포함된 `OFL.txt` (SIL Open Font License 1.1)
- `GowunDodum-Regular.woff2`는 공식 Regular TTF를 FontTools로 WOFF2 압축한 파일이다. 글리프를 제거하거나 글꼴 디자인을 변경하지 않았다.
- `next/font/local`로 제공하며 방문자의 브라우저에서 Google Fonts에 요청하지 않는다.
