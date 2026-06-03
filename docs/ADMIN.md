# EJU Admin 검수 콘솔

OCR 결과를 사람이 빠르게 검수하는 관리자 시스템. 기존 앱과 **완전히 분리**된 스코프로 동작한다.

## 접속

웹/Electron 모두 해시 라우트로 진입한다 (서버 설정·SPA 폴백 불필요):

```
<앱 주소>#/admin/dashboard
```

예) 로컬 dev: `http://localhost:5173/EJUScore/#/admin/dashboard`
콘솔 안의 「앱으로 돌아가기」를 누르면 기존 앱으로 복귀한다.

## 필수 페이지 (구현 완료)

| 라우트 | 파일 | 기능 |
|--------|------|------|
| `#/admin/dashboard` | `src/admin/pages/Dashboard.jsx` | 실코퍼스 통계·검수현황 (총 문항, 평균 신뢰도, 저신뢰/노이즈/중복, 영역·유형·연도 분포) |
| `#/admin/uploads` | `src/admin/pages/Uploads.jsx` | PDF 재업로드·대량 업로드(드롭존, sha256 중복 제외)·OCR 재실행·작업 큐 |
| `#/admin/ocr-review` | `src/admin/pages/OcrReview.jsx` | OCR 결과 **빠른 검수** (키보드 O/F/←→, 필터, 진행률) |
| `#/admin/question-review` | `src/admin/pages/QuestionReview.jsx` | 문제 분리 검수 · 정답 검수 · 중복 검수 (3 탭) |
| `#/admin/vector` | `src/admin/pages/Vector.jsx` | 벡터 재생성 + 의미 검색 테스트 (실제 `computeEmbedding`) |
| `#/admin/datasets` | `src/admin/pages/Datasets.jsx` | 학습셋 필터·시험단위 분할·JSONL 내보내기 |

## 요구 기능 매핑

- **OCR 결과 검수** → OcrReview (raw_text 원문 + 신뢰도 + 의미글자 비율, O/F 단축키 자동 진행)
- **문제 분리 검수** → QuestionReview › 분리 탭 (분리 점검 권장 휴리스틱)
- **정답 검수** → QuestionReview › 정답 탭 (원본에 정답키 없음 → 검수자가 직접 지정, 로컬 저장)
- **중복 문제 검수** → QuestionReview › 중복 탭 (정규화 텍스트 해시 그룹)
- **벡터 재생성** → Vector (실제 임베딩 함수로 재인덱싱, 실시간 진행률)
- **OCR 재실행** → Uploads (기존 시험 비파괴 재처리 작업 등록)
- **PDF 재업로드** → Uploads (드롭존, 실제 파일 sha256 검증)

## 기술 스택 / 설계 원칙

- **Tailwind CSS v3 + shadcn/ui 패턴** — `src/admin/ui/*` 에 실제 컴포넌트 소스. preflight(전역 리셋) **비활성**, `content: ['./src/admin/**']` 로 스코프 → 기존 앱 UI 픽셀 불변.
- **모든 스타일은 `.admin-scope` 하위로 스코프** (토큰: `--admin-*`). 다크모드는 앱의 `data-theme="dark"` 를 그대로 따른다.
- **모바일 우선 / iPad / 데스크톱** — `md:` 분기로 모바일 상단바+드로어 ↔ 고정 사이드바, 콘텐츠 `max-w-6xl`, 터치 타깃 ≥ 44px.
- **Toss 풍 UI** — 소프트 블루(#3182f6) primary, 넉넉한 여백, 라운드, 미세 모션.
- **데이터 소스** — `src/admin/lib/dataAdapter.js` 가 유일한 seam. 현재 `public/dataset/comprehensive/**` 의 **실제 OCR JSON**(2002–2015, r1/r2, 28개 시험)을 읽는다. 가짜 데이터 0.
- **검수 결과 저장** — `src/admin/lib/reviewStore.js` (localStorage). ARCHITECTURE_V2 의 `questions.review_status` / `question_classifications` / `jobs` 와 1:1 대응.

## Supabase 전환 경로 (ARCHITECTURE_V2)

`dataAdapter.js` · `reviewStore.js` 의 메서드 시그니처를 그대로 둔 채 내부를 `@supabase/supabase-js` 호출로 교체하면 화면 코드 변경 없이 백엔드 전환된다. 현재 벡터는 384차원 TF-BoW(프로젝트 기존 함수)이며, 추후 실제 다국어 임베딩 + pgvector HNSW 로 교체 예정(Vector 화면에 명시).

## 검증

- `npx vite build` → PASS (admin 청크 분리 빌드, CSS 스코프 확인)
- `npx vitest run` → 568/568 PASS (기존 테스트 무영향)
- 기존 파일 변경: `src/main.jsx` +21줄(해시 `#/admin` 진입 분기)뿐. 그 외 전부 신규 파일.
