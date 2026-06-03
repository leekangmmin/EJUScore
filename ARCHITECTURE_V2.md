# ARCHITECTURE_V2 — EJU 기출문제 분석 플랫폼 전면 재설계

> **상태:** 설계 문서 (코드 미작성). OCR 대량 데이터 유입 **이전** 단계에서 작성됨.
> **작성일 기준 현재 데이터:** 종합과목 `dataset_consolidated.json` = 44개 시험 / 1,448문항 (2002–2025), 수학 다년도 별도. 모두 로컬 JSON.
> **목표 데이터:** OCR 결과 JSON 수백 MB, 문항 수십만 단위.
> **원칙:** 본 문서의 수치 중 *현재값*은 실제 파일에서 확인된 값이며, *목표/추정값*은 모두 "추정"으로 명시한다. 허위 벤치마크·가짜 성능 수치는 포함하지 않는다.

---

## 0. 현재 아키텍처(V1) 실측 진단

설계는 추측이 아닌 실제 코드 위에서 출발한다. 현재 저장소에서 확인된 사실:

| 영역 | 현재 구현 | 파일(실측) | 한계 |
|------|-----------|-----------|------|
| 영속 저장 | 브라우저 `localStorage` (사용자 성적), IndexedDB 스키마 정의됨(DB_VERSION=3) | `src/utils/storage.js`, `src/interfaces/storage.js`, `src/db/database.js` | 단일 기기·단일 브라우저. 수십만 행 불가. 탭 간 동기화 없음 |
| 기출 데이터 | 정적 JSON 번들 (`public/dataset/**`) | `dataset/comprehensive/*`, `engineInitializer.js` | 빌드 시 고정. 증분 추가 불가. 전부 메모리 로드 |
| OCR | 멀티엔진 앙상블 *설계만* 존재, 다수가 mock | `src/ocr/orchestrator.js` (paddle/surya/easyocr는 mock 폴백) | 실제 대량 처리·재처리·작업 큐 없음 |
| 벡터 검색 | 384차원 TF-BoW + 고정 lexicon, cosine 전수 비교 | `src/vector/embeddingStore.js` | 실제 임베딩 모델 아님(주석에 "in production use all-MiniLM"). O(N) 풀스캔 |
| 스키마 | 캐노니컬 스키마 정의 존재 | `src/schemas/core.js` (`QuestionSchema`, `OcrResultSchema`, `ExamRecordSchema`, `EJU_CONSTANTS`) | DB 제약·인덱스로 강제되지 않음(문서상 타입) |
| 분류 | domain/topic/difficulty 필드 존재, 다수 `"unknown"`/`""` | `dataset/comprehensive/**` | 초기 연도 OCR 노이즈 심각(실측: 깨진 텍스트 다수) |

**핵심 결론:** V1은 *로컬 우선(local-first) 단일 사용자 앱*이다. 수십만 문항·다중 사용자·서버 측 벡터 검색·재처리 큐를 감당하도록 설계되지 않았다. V2는 **저장·검색 계층을 Supabase(Postgres + pgvector + Storage + Edge Functions)로 이전**하고, 기존 스키마(`core.js`)와 분석 엔진(`intelligence/*`)은 **계약(contract)으로 재사용**한다.

### 0.1 V2 설계 비기능 요구(실측 기반 가정)

- 현재 종합 1,448문항 → 목표 수십만. **보수적 추정: 200,000~600,000 문항** (24개 연도 × 다회차 × 다과목 × OCR 분할). *이 수치는 추정이며 실데이터 유입 시 갱신.*
- 임베딩 차원: 모델 의존(아래 §4). 50만 문항 × 768차원 × 4바이트 ≈ **1.5GB raw 벡터** → pgvector + HNSW 인덱스 필요(전수 cosine 불가).
- 원본 OCR JSON 수백 MB → **DB 행이 아니라 Storage 객체**로 보관, 파싱 산출물만 정규화 테이블에 적재.

---

## 1. 데이터베이스 구조 재설계 (요구사항 #1)

### 1.1 스택 결정

| 계층 | 선택 | 근거 |
|------|------|------|
| RDBMS | **Supabase Postgres** | 요구사항 명시. 관계형 무결성 + JSONB 유연성 동시 |
| 벡터 | **pgvector (HNSW)** | 별도 벡터 DB 불필요, 문항 메타와 조인 가능 |
| 전문검색 | **tsvector(GIN) + pg_bigm** | 일본어/CJK는 형태소 경계가 모호 → bigram 트라이그램 보조 |
| 원본 보관 | **Supabase Storage 버킷** | 수백 MB JSON·이미지 = blob, DB 부적합 |
| 비동기 처리 | **`jobs` 테이블 + Edge Function/Worker** | OCR 재처리·임베딩·분류를 큐로 분리 |
| 인증/권한 | **Supabase Auth + RLS** | 관리자/일반 사용자 분리(요구 #6) |

> 라이브러리 추가는 본 설계의 *제안*이다. 실제 도입은 사용자 승인 후 별도 단계에서 진행한다(`@supabase/supabase-js` 등).

### 1.2 ER 개요

```
auth.users ──< profiles (role: admin|editor|viewer)

uploads ──< ocr_documents ──< ocr_pages
                  │
                  └──< questions ──< question_options
                          │  ├──< question_classifications (type/jlpt/eju_difficulty)
                          │  ├──< question_embeddings (pgvector)
                          │  ├──< question_assets (이미지/도표 ref → Storage)
                          │  └──< ai_analyses
                          │
exams ──< exam_questions >── questions   (M:N: 한 문항이 여러 시험 인스턴스에 매핑 가능)

subjects / domains / topics  (분류 마스터, 계층)
topic_frequency_yearly        (집계 머티리얼라이즈드 뷰)
training_snapshots ──< training_examples   (AI 학습셋, §5)
jobs                          (비동기 작업 큐: ocr_reprocess / embed / classify / export)
audit_log
```

### 1.3 핵심 테이블 DDL (제안)

```sql
-- ── 분류 마스터 (계층: subject > domain > topic) ──────────────
create table subjects (
  id text primary key,                 -- 'comprehensive','japanese','math','science'
  name_ko text not null,
  max_score int                        -- EJU_CONSTANTS: comprehensive=198 등
);
create table domains (
  id text primary key,                 -- 'economy','politics','history','geography','society'
  subject_id text references subjects(id),
  name_ko text not null
);
create table topics (
  id bigint generated always as identity primary key,
  domain_id text references domains(id),
  canonical_name text not null,
  aliases text[] default '{}',         -- OCR 표기 흔들림 흡수
  unique (domain_id, canonical_name)
);

-- ── 업로드 / 원본 OCR (요구 #2) ──────────────────────────────
create table uploads (
  id uuid primary key default gen_random_uuid(),
  uploader uuid references auth.users(id),
  filename text not null,
  byte_size bigint,
  storage_path text not null,          -- Storage 버킷 경로(원본 JSON/PDF)
  sha256 text unique,                  -- 멱등성: 동일 파일 재업로드 차단
  status text not null default 'received', -- received|parsing|parsed|failed
  created_at timestamptz default now()
);
create table ocr_documents (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references uploads(id) on delete cascade,
  subject_id text references subjects(id),
  exam_year int,
  exam_round int,                      -- 1|2 (EJU 연 2회)
  source_type text,                    -- 'pdf'|'image'|'json'
  ocr_engine text,                     -- 'paddle'|'surya'|'tesseract'|'vision'|...
  ocr_version text,                    -- 재처리 버전 추적
  raw_json_path text,                  -- 파싱 전 원본 위치(Storage)
  page_count int,
  avg_confidence numeric(5,4),
  created_at timestamptz default now()
);
create table ocr_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references ocr_documents(id) on delete cascade,
  page_no int not null,
  image_path text,                     -- 렌더된 페이지 이미지(Storage)
  raw_text text,                       -- 페이지 단위 원시 텍스트
  blocks jsonb,                        -- bbox/blocks (orchestrator 산출)
  confidence numeric(5,4),
  unique (document_id, page_no)
);

-- ── 문제 단위 (요구 #3) ──────────────────────────────────────
create table questions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references ocr_documents(id) on delete set null,
  subject_id text references subjects(id),
  domain_id text references domains(id),
  topic_id bigint references topics(id),
  exam_year int,
  exam_round int,
  number int,                          -- 시험 내 문항번호
  raw_text text,                       -- OCR 원문 (core.js: rawText)
  cleaned_text text,                   -- 의미 재구성본 (core.js: cleanedText)
  stem text,                           -- 발문(질문 본문)
  has_diagram boolean default false,
  has_table boolean default false,
  ocr_confidence numeric(5,4),
  content_hash text,                   -- 중복 탐지(정규화 텍스트 해시)
  source text default 'ocr',           -- 'ocr'|'manual'|'import'
  review_status text default 'auto',   -- 'auto'|'verified'|'rejected'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade,
  label text,                          -- '1'..'4' / 'ア'..'エ'
  text text,
  is_correct boolean                   -- 정답키 확보 시
);
create table question_classifications (
  question_id uuid primary key references questions(id) on delete cascade,
  question_type text,                  -- 'multiple_choice'|'graph_analysis'|'fill_blank'|... (core.js type 집합)
  type_confidence numeric(5,4),
  jlpt_level text,                     -- 'N1'..'N5'|null  (요구: JLPT 수준 추정)
  jlpt_confidence numeric(5,4),
  eju_difficulty numeric(4,2),         -- 1.00–10.00 (core.js difficulty 연속화)
  eju_difficulty_confidence numeric(5,4),
  classifier_version text,             -- 재현성/재처리 추적
  classified_at timestamptz default now()
);
```

### 1.4 설계 원칙

- **불변 원본 + 가변 파생:** `uploads`/`ocr_documents`/`ocr_pages.raw_text`는 사실상 불변. 분류·임베딩·정제는 *버전 컬럼*을 둔 파생 테이블로 분리 → 재처리(#7) 시 원본 손실 없음.
- **모든 추정에 신뢰도 동반:** `*_confidence` 컬럼을 강제. (Phase B에서 확립한 원칙 — "분석 결과에는 항상 신뢰도·근거·불확실성을 표시" — DB 레벨로 승격.)
- **멱등성:** `uploads.sha256`, `questions.content_hash`로 중복 업로드/문항 차단.
- **RLS:** `viewer`는 `select`만, `editor`는 검수 컬럼만 수정, `admin`은 전체 + `jobs` 제어.

---

## 2. OCR 데이터 저장 구조 (요구사항 #2)

수백 MB JSON을 **DB 행으로 넣지 않는다.** 3단 분리:

```
[원본 레이어]  Storage 버킷  raw/{sha256}.json         ← 불변, 감사용
       │  (Edge Function: parse)
       ▼
[스테이징]    ocr_documents + ocr_pages (raw_text, blocks jsonb)
       │  (Edge Function: split → §3)
       ▼
[정규화]      questions + question_options
```

### 2.1 적재 파이프라인 (스트리밍)

수백 MB 단일 JSON은 메모리 로드 금지. **스트리밍 파서(JSON 배열 청크)** 로 처리:

1. 업로드 → Storage 저장, `uploads` 행 생성(`status=received`).
2. `jobs`에 `parse` 작업 enqueue.
3. 워커가 Storage 객체를 **스트림으로** 읽어 `exams[].questions[]`를 N개씩 배치 `insert`(예: 500행/트랜잭션).
4. 진행률을 `uploads.status` + `jobs.progress`로 갱신 → 관리자 UI 폴링/Realtime 구독.

> 현재 실데이터 형태(`dataset_consolidated.json`)는 `{ exams: [{ year, round, questions: [{ id, number, text, answer_choices, ocr_confidence, domain, topic, subtopic, difficulty, keywords, concepts }] }] }`. 파서는 이 형태를 1차 입력 계약으로 삼고, 신규 OCR 포맷은 어댑터로 흡수한다.

### 2.2 원본 보존 정책

- `raw_json_path`/`image_path`는 Storage 경로만 DB에 저장.
- OCR 재처리 시 **새 `ocr_documents` 행**을 만들고 `ocr_version`을 올린다(기존 행 비파괴) → 버전 비교·롤백 가능.

---

## 3. 문제 단위 분리 구조 (요구사항 #3)

OCR 페이지 텍스트 → 개별 문항으로 분해하는 **결정적(deterministic) + 휴리스틱** 분리기.

### 3.1 분리 단계

```
ocr_pages.raw_text / blocks
  → ① 문항 경계 탐지 (번호 패턴 '問N', '1.', 마커 / blocks의 bbox 줄바꿈)
  → ② 발문(stem) vs 선택지 분리 (answer_choices 패턴 'ア/イ/ウ/エ', '①②③④')
  → ③ 자료 첨부 감지 (has_diagram/has_table ← blocks 유형)
  → ④ 정규화 텍스트 → content_hash 산출 → 중복 병합
  → questions + question_options insert
```

### 3.2 중복·노이즈 처리 (실측 근거)

현재 데이터에 **깨진 OCR 텍스트**(예: `"ーーブーマダブーイマダーてマママ..."`)와 동일 `number`가 반복되는 행이 실재한다. 따라서:

- `content_hash` = 정규화(공백/기호 제거, 길이≥임계) 후 해시. 임계 미만·엔트로피 낮은 텍스트는 `review_status='auto'` + `ocr_confidence` 낮음으로 **격리**(삭제 아님).
- 동일 (year, round, number, hash) 충돌 시 **최고 신뢰도 1건 채택**, 나머지는 `rejected` 마킹(감사 추적 유지).

### 3.3 안정 ID

- 문항 `id`는 UUID(불변). 외부 참조(임베딩/분석/시험매핑)는 모두 이 UUID로 FK. 재처리해도 가능한 한 `content_hash` 매칭으로 **동일 문항에 동일 UUID 유지**(ID 안정성 → 사용자 오답노트 연속성 보장).

---

## 4. 검색 인덱스 구조 (요구사항 #4)

3종 검색을 단일 Postgres에서 제공:

### 4.1 벡터(의미) 검색 — pgvector

```sql
create extension if not exists vector;
create table question_embeddings (
  question_id uuid primary key references questions(id) on delete cascade,
  model text not null,                 -- 'bge-m3'|'multilingual-e5'|... (실모델 명시)
  dim int not null,
  embedding vector(768),               -- 모델 차원에 맞춤
  embedded_at timestamptz default now()
);
create index on question_embeddings
  using hnsw (embedding vector_cosine_ops);
```

- **모델 결정 가이드(제안, 실측 검증 후 확정):** 일본어 포함 다국어 → `bge-m3`(1024d) 또는 `multilingual-e5-base`(768d). **현재 `embeddingStore.js`의 TF-BoW 384d는 실제 임베딩이 아니므로 교체 대상.** 실제 도입 전 소규모 샘플로 검색 품질을 측정해 모델/차원을 확정한다(가짜 수치 금지).
- HNSW로 O(log N) 근사 최근접 → 수십만 행에서 전수 cosine(현재 방식) 회피.

### 4.2 전문(키워드) 검색 — CJK 대응

```sql
alter table questions add column tsv tsvector
  generated always as (to_tsvector('simple', coalesce(cleaned_text, raw_text))) stored;
create index on questions using gin (tsv);
-- 일본어 형태소 경계 보완: pg_bigm
create extension if not exists pg_bigm;
create index on questions using gin (cleaned_text gin_bigm_ops);
```

### 4.3 필터 검색 — 연도/과목/영역 (요구: 연도별·과목별 필터)

```sql
create index on questions (subject_id, exam_year, exam_round);
create index on questions (domain_id, exam_year);
create index on questions (topic_id);
create index on question_classifications (jlpt_level);
create index on question_classifications (question_type);
create index on questions (eju_year_domain) ... -- 복합 필터 자주 쓰는 조합
```

### 4.4 하이브리드 검색

벡터 + 키워드 + 필터를 **RPC 함수 1개**로 결합(연도/과목 WHERE → 후보 축소 → 벡터 ORDER BY → tsvector rerank). 프론트는 단일 `rpc('search_questions', {...})` 호출.

---

## 5. AI 학습 데이터셋 생성 구조 (요구사항 #5)

분석/예측 모델 학습용 데이터를 **재현 가능·버전 고정** 스냅샷으로 산출.

```sql
create table training_snapshots (
  id uuid primary key default gen_random_uuid(),
  name text, purpose text,             -- 'type_classifier'|'jlpt'|'difficulty'|'frequency'
  filter jsonb,                        -- 추출 조건(연도범위/과목/최소신뢰도)
  split jsonb,                         -- {train:0.7, val:0.15, test:0.15}
  row_count int,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);
create table training_examples (
  snapshot_id uuid references training_snapshots(id) on delete cascade,
  question_id uuid references questions(id),
  split text,                          -- 'train'|'val'|'test'
  features jsonb,                      -- 텍스트/메타/임베딩 참조
  label jsonb                          -- type/jlpt/difficulty 등 정답 라벨
);
```

### 5.1 생성 원칙

- **누수 방지:** split은 *문항 단위가 아니라 시험(year,round) 단위*로 분할(같은 시험 문항이 train/test에 동시 등장 금지).
- **품질 게이트:** `ocr_confidence ≥ τ` 및 `review_status in ('auto','verified')`만 포함. τ는 스냅샷 `filter`에 기록 → 재현 가능.
- **출력:** JSONL을 Storage `exports/{snapshot_id}.jsonl`로 산출(Edge Function `export` job). 외부 학습 파이프라인이 그대로 소비.
- **라벨 출처 표기:** 라벨이 사람검수(`verified`)인지 자동분류인지 `label.source`로 구분 → 모델 신뢰도 평가 시 분리.

---

## 6. 관리자 페이지 (요구사항 #6)

신규 라우트 `/admin` (RLS `role=admin`). 기존 사용자 UI(Dashboard/TrendDashboard 등)는 **건드리지 않는다**(Phase A/B에서 확립한 "데스크톱 UI 비파괴" 원칙 유지). 관리자 화면은 별도 컴포넌트 트리.

| 패널 | 기능 | 연결 테이블/잡 |
|------|------|----------------|
| 업로드 모니터 | 진행률, 실패 재시도 | `uploads`, `jobs` |
| 문항 검수 | OCR 원문↔정제본 비교, 분류 수정, `verified/rejected` 토글 | `questions`, `question_classifications` |
| 분류 대시보드 | 과목·연도·JLPT·유형 분포, `unknown` 비율 | 집계 뷰 |
| 재처리 콘솔 | 문서/문항 선택 → reprocess enqueue(§7) | `jobs` |
| 학습셋 빌더 | 필터 → 스냅샷 생성/내보내기(§5) | `training_snapshots` |
| 감사 로그 | 누가 무엇을 변경 | `audit_log` |

- **반응형:** 관리자 페이지도 §9 반응형 규약 적용(태블릿에서 검수 작업 가능하도록 카드 레이아웃 대체 뷰).

---

## 7. OCR 재처리 기능 (요구사항 #7)

원본 비파괴 + 버전 증가 + 비동기 잡.

```sql
create table jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,                  -- 'parse'|'ocr_reprocess'|'embed'|'classify'|'export'
  payload jsonb not null,              -- {document_id} / {question_ids[]} / {model} ...
  status text default 'queued',        -- queued|running|done|failed
  progress numeric(5,2) default 0,
  error text,
  attempts int default 0,
  created_at timestamptz default now(),
  finished_at timestamptz
);
```

### 7.1 재처리 시나리오

1. **OCR 엔진 교체/업그레이드:** 새 `ocr_documents` 버전 생성 → 페이지 재인식 → §3 재분리 → `content_hash`로 기존 문항 UUID 승계.
2. **분류기 재학습 반영:** `classify` job → `question_classifications`의 `classifier_version` 갱신(문항 텍스트는 불변).
3. **임베딩 모델 교체:** `embed` job → `question_embeddings.model/dim` 교체, HNSW 인덱스 재구축.

### 7.2 안전장치

- 멱등 키(`document_id + ocr_version`)로 중복 재처리 차단.
- 실패 시 `attempts` 증가 + 지수 백오프, 원본·기존 파생물은 **삭제하지 않음**(롤백 가능).
- 재처리 diff(전/후 텍스트·분류 변화)를 관리자에게 표시 후 **승인 시에만 채택** 옵션.

---

## 8. 대량 업로드 기능 (요구사항 #8)

수백 MB·다수 파일을 안정적으로.

- **분할 업로드(resumable):** Supabase Storage `resumable upload`(TUS) → 네트워크 끊김 복구.
- **멱등:** 업로드 직후 `sha256` 계산 → 기존 존재 시 스킵(중복 적재 방지).
- **백프레셔:** 적재 워커는 배치 insert(500행) + 트랜잭션 단위 커밋, 동시성 제한(잡 큐 worker pool).
- **포맷 어댑터:** `json`(현재 consolidated 형태) / `pdf`(→ OCR job) / `zip`(다파일) 입력별 어댑터. 어댑터는 §0 `core.js` 스키마로 정규화.
- **드라이런:** 실제 insert 전 "예상 N문항 / 중복 M / 노이즈 K" 미리보기 → 관리자 확인 후 커밋.

---

## 9. 반응형(모바일/태블릿/데스크톱) 전략

기존 프로젝트에서 확립된 규약 **그대로 계승**(별도 모바일 컴포넌트, 데스크톱 비파괴):

- `useIsMobile()`(`max-width:768px`) 패턴 유지. 태블릿 구간(769–1024px)을 위한 `useBreakpoint()`(mobile/tablet/desktop) **신규 훅** 추가 제안.
- 신규 화면(관리자·검색)은 `if (isMobile) return <MobileX/>` 전용 컴포넌트 분리. 데스크톱 레이아웃·타이포·차트 픽셀 불변.
- 표→카드, 대형 차트→접이식(`<details>`), 터치 타깃 ≥44px — 기존 Phase A 규약 동일 적용.
- 지원 폭: 375 / 390 / 430 / 768 / 1024 / 1280+.

---

## 10. 도메인 분석 파이프라인 (요구: 유형분류·JLPT·EJU난이도·빈도)

모두 **신뢰도 동반**, 단정적 표현 금지(Phase B 언어 규약 계승: "가능성", "참고 지표", 불확실성 명시).

### 10.1 문제 유형 자동 분류
- 입력: `stem` + `question_options` 패턴 + `has_diagram/has_table`.
- 출력: `question_type` ∈ core.js 집합 + `type_confidence`.
- 방식: 규칙(선택지 마커·도표 유무) → 약지도 라벨 → 분류기. **초기엔 규칙 기반 + confidence, 데이터 축적 후 학습형으로 승격.**

### 10.2 JLPT N1~N5 수준 추정
- 어휘·문형의 JLPT 등급 사전 매칭 비율 + 문장 복잡도 → `jlpt_level` + `jlpt_confidence`.
- **주의:** EJU 종합과목은 본질이 JLPT 시험이 아니므로 "추정(estimate)"으로만 표기. 일본어 과목에 1차 적용, 타 과목은 *지문 난이도 보조지표*로 한정.

### 10.3 EJU 난이도 추정
- core.js `difficulty(1–10)` 연속화(`eju_difficulty numeric`). 입력: 정답률(사용자 데이터 누적 시)·문항 길이·자료 복잡도·어휘 등급.
- 사용자 응답 데이터가 쌓이면 IRT(문항반응이론) 기반 보정 — *데이터 충분 전엔 텍스트 기반 추정 + 낮은 confidence*.

### 10.4 출제 빈도 분석
- `topic_frequency_yearly` 머티리얼라이즈드 뷰: `(topic_id, exam_year) → count`. 재처리/적재 후 `refresh`.
- 기존 `intelligence/` 빈도·예측 로직과 **동일 계약**으로 연결 → TrendDashboard 등 기존 분석 화면은 데이터 소스만 교체(로컬 JSON → Supabase RPC), UI 비파괴.

---

## 11. 기존 자산 매핑 (V1 → V2)

| V1 자산 | V2 처리 |
|---------|---------|
| `src/schemas/core.js` | **계약으로 유지.** DB 컬럼이 이 스키마를 구현. 파괴 금지 |
| `src/db/database.js` (IndexedDB) | **로컬 캐시/오프라인 계층으로 강등.** 원천(SoT)은 Supabase. 동기화 어댑터 추가 |
| `src/interfaces/storage.js` | "Swapable: localStorage ↔ IndexedDB ↔ Cloud" 주석대로 **Supabase 어댑터 추가** (설계 의도와 합치) |
| `src/vector/embeddingStore.js` | TF-BoW → **실모델 임베딩 + pgvector** 로 교체. cosine 함수는 폴백용 유지 |
| `src/ocr/orchestrator.js` | mock 폴백 → 실엔진 + `jobs` 큐 연동. 앙상블 로직 재사용 |
| `intelligence/*`, `TrendDashboard` 등 | **UI/로직 비파괴.** 데이터 소스만 RPC로 교체 |
| `public/dataset/**` 정적 JSON | 1회 **마이그레이션 적재**(seed) 후, 증분은 업로드 파이프라인으로 |

---

## 12. 단계별 구현 로드맵 (제안, 코드 미착수)

| 단계 | 산출물 | 검증 기준 |
|------|--------|-----------|
| P0 | Supabase 프로젝트 + 본 DDL 마이그레이션 + RLS | 마이그레이션 적용, 빈 스키마 통과 |
| P1 | 현재 `dataset/**` → V2 스키마 seed 적재 스크립트 | 1,448 종합문항 무손실 적재(행 수 일치 검증) |
| P2 | 업로드(#8) + 파싱/분리(#2,#3) + 잡 큐(#7) | 드라이런 카운트 = 실제 적재 카운트 |
| P3 | 임베딩(실모델) + 하이브리드 검색 RPC(#4) | 샘플 쿼리 정성 평가(가짜 지표 없이) |
| P4 | 분류 파이프라인(#10) + 신뢰도 컬럼 채움 | confidence 분포·unknown 비율 리포트 |
| P5 | 관리자 페이지(#6) + 검수/재처리 UI(#7) | 검수→verified 반영, 재처리 비파괴 확인 |
| P6 | 학습셋 빌더/내보내기(#5) | 시험단위 split 누수 0 검증 |
| P7 | 기존 분석 화면 데이터 소스 전환 | 기존 테스트 그린 유지, UI 픽셀 불변 |

> **각 단계는 사용자 승인 후 착수.** 본 문서는 설계만 확정한다. 마이그레이션 실행·라이브러리 설치·배포는 별도 승인 필요.

---

## 13. 리스크 및 미해결 결정사항

1. **비용/호스팅:** Supabase 무료 티어 한도(DB 0.5GB, Storage 1GB) < 수백 MB 원본 + 1.5GB 벡터(추정). → 유료 플랜/셀프호스트 결정 필요. *사용자 결정 항목.*
2. **임베딩 모델·차원 미확정:** 실데이터 샘플 품질 측정 후 확정(가짜 벤치마크 금지).
3. **OCR 실엔진:** 현재 다수 mock. 실제 paddle/surya/vision 연동은 별도 작업.
4. **로컬-우선 vs 서버-우선 충돌:** 현재 앱은 오프라인 동작(Electron/GitHub Pages). 서버 이전 시 오프라인 모드 정책(IndexedDB 캐시 동기화) 정의 필요.
5. **개인정보:** 사용자 성적/오답 데이터를 클라우드 저장 시 RLS·암호화·동의 절차 필요.
6. **문항 저작권:** 기출문제 원문 대량 저장·재배포 범위는 법적 검토 필요(*저장 설계와 별개로 공개 정책 결정 필요*).

---

## 14. 요구사항 충족 매트릭스

| # | 요구 | 본 문서 위치 |
|---|------|-------------|
| 1 | DB 구조 재설계 | §1 |
| 2 | OCR 데이터 저장 구조 | §2 |
| 3 | 문제 단위 분리 구조 | §3 |
| 4 | 검색 인덱스 구조 | §4 |
| 5 | AI 학습 데이터셋 생성 구조 | §5 |
| 6 | 관리자 페이지 | §6 |
| 7 | OCR 재처리 기능 | §7 |
| 8 | 대량 업로드 기능 | §8 |
| — | 수십만 문항 처리 | §0.1, §2.1, §4.1 |
| — | 모바일/태블릿/데스크톱 | §9 |
| — | Supabase 기반 | §1.1 |
| — | 벡터 검색 | §4.1 |
| — | AI 분석 | §5, §10 |
| — | 연도별/과목별 필터 | §4.3 |
| — | 문제 유형 자동 분류 | §10.1 |
| — | JLPT N1~N5 추정 | §10.2 |
| — | EJU 난이도 추정 | §10.3 |
| — | 출제 빈도 분석 | §10.4 |

---

*본 설계 문서는 코드 작성 이전 단계의 청사진이다. 실제 구현(마이그레이션, 라이브러리 설치, 데이터 적재, 배포)은 각 단계별 사용자 승인 후 진행한다. 모든 분석 산출물은 신뢰도·근거·불확실성을 동반하며, 허위 수치를 포함하지 않는다.*
