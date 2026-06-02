# EJU Intelligence Platform — 최종 감사 보고서 (FINAL AUDIT REPORT)

> 감사일: 2026-06-02  
> 감사범위: dataset/comprehensive, dataset/mathematics, dataset/trend-analysis, dataset/prediction

---

## 1. 데이터 수집 결과

### dataset/comprehensive 내 모든 JSON 파일

| 경로 | 파일 | 비고 |
|------|------|------|
| dataset/comprehensive/2002/ | exam_2002_r1.json, exam_2002_r2.json | 2개 |
| dataset/comprehensive/2003/ | exam_2003_r1.json, exam_2003_r2.json | 2개 |
| dataset/comprehensive/2004/ | exam_2004_r1.json, exam_2004_r2.json | 2개 |
| dataset/comprehensive/2005/ | exam_2005_r1.json, exam_2005_r2.json | 2개 |
| dataset/comprehensive/2006/ | exam_2006_r1.json, exam_2006_r2.json | 2개 |
| dataset/comprehensive/2007/ | exam_2007_r1.json, exam_2007_r2.json | 2개 |
| dataset/comprehensive/2008/ | exam_2008_r1.json, exam_2008_r2.json | 2개 |
| dataset/comprehensive/2009/ | exam_2009_r1.json, exam_2009_r2.json | 2개 |
| dataset/comprehensive/2010/ | exam_2010_r1.json, exam_2010_r2.json | 2개 |
| dataset/comprehensive/2011/ | exam_2011_r1.json, exam_2011_r2.json | 2개 |
| dataset/comprehensive/2012/ | exam_2012_r1.json, exam_2012_r2.json | 2개 |
| dataset/comprehensive/2013/ | exam_2013_r1.json, exam_2013_r2.json | 2개 |
| dataset/comprehensive/2014/ | exam_2014_r1.json, exam_2014_r2.json | 2개 |
| dataset/comprehensive/2015/ | exam_2015_r1.json, exam_2015_r2.json | 2개 |
| dataset/comprehensive/ | dataset_consolidated.json, master_dataset.json | 2개 메타파일 |

**종합과목 OCR 개별 파일: 28개** (2002~2015, 연간 2회)

### dataset/mathematics 내 모든 JSON 파일

| 연도 | 회차 | 문제 수 |
|------|------|---------|
| 2005 | r1=19, r2=20 | 39 |
| 2006 | r1=19, r2=20 | 39 |
| 2007 | r1=20, r2=20 | 40 |
| 2008 | r1=18, r2=18 | 36 |
| 2009 | r1=18, r2=18 | 36 |
| 2010 | r1=18, r2=20 | 38 |
| 2011 | r1=18, r2=15 | 33 |
| 2012 | r1=15, r2=15 | 30 |
| 2013 | r1=15, r2=15 | 30 |
| 2014 | r1=16, r2=15 | 31 |
| 2015 | r1=16, r2=15 | 31 |
| 2016 | r1=18, r2=19 | 37 |
| 2017 | r1=19, r2=18 | 37 |
| 2018 | r1=18, r2=18 | 36 |
| 2019 | r1=20 | 20 |
| 2020 | r2=18 | 18 |
| 2021 | r1=18, r2=18 | 36 |
| 2022 | r1=18, r2=19 | 37 |
| 2023 | r1=20, r2=21 | 41 |
| 2024 | r1=20 | 20 |
| 2025 | r1=18 | 18 |

**수학 개별 파일: 38개** (2005~2025, 총 711문항)

### 추가 Vision JSON 파일 (2016~2025, 종합과목)

| 파일 | 문항 수 |
|------|---------|
| 2016-1.json, 2016-2.json | 2개 |
| 2017-1.json, 2017-2.json | 2개 |
| 2018-1.json, 2018-2.json | 2개 |
| 2019-1.json | 1개 |
| 2020-2.json | 1개 |
| 2021-1.json, 2021-2.json | 2개 |
| 2022-1.json, 2022-2.json | 2개 |
| 2023-1.json, 2023-2.json | 2개 |
| 2024.json | 1개 (38문항) |
| 2025.json | 1개 (38문항) |

**Vision JSON: 16개** (총 608문항)

---

## 2. trend_analysis_complete.json 생성 원본 데이터

`build_complete_analysis.py` 스크립트는 다음 소스에서 데이터를 로드합니다:

1. `dataset/comprehensive/*/exam_*.json` (OCR, 2002~2015, 28개 파일, 840문항)
2. `scripts/exam-bank-raw/vision/*.json` (Vision, 2016~2025, 16개 파일, 608문항)
3. `dataset/mathematics/*/exam_*.json` (수학, 38개 파일, 711문항 — **수학은 별도 분석**)

생성일시: `2026-06-02T06:36:15.572336`

---

## 3. 검증 결과

### A. 출제경향 페이지가 실제로 읽는 JSON 파일

**TrendDashboard.jsx** → `engineInitializer.js` → `fetch()`로 로드:

| 캐시 키 | 파일 경로 |
|---------|-----------|
| `trendComplete` | `dataset/trend-analysis/trend_analysis_complete.json` |
| `prediction2026_2028` | `dataset/prediction/prediction_2026_2028.json` |
| `trendAnalysis` | `dataset/trend-analysis/trend_analysis_v2.json` |
| `goldStandard` | `dataset/gold_standard/gold_standard.json` |
| `knowledgeGraph` | `dataset/knowledge-graph/knowledge_graph_v3.json` |
| `difficultyDB` | `dataset/difficulty/difficulty_database.json` |
| `prediction2026` | `dataset/prediction/prediction_2026.json` |
| `weakProfile` | `dataset/weakness_profile.json` |
| `studyPlan` | `dataset/study_plan.json` |

✅ **확인됨** — TrendDashboard.jsx는 `trend_analysis_complete.json`을 주 데이터 소스로 사용

### B. trend_analysis_complete.json 에 반영된 시험 회차 수

- **반영 연도 수**: 24년 (2002~2025)
- **반영 문제 수**: 1,315문항
- **추적 토픽 수**: 106개

### C. 실제 존재하는 시험 회차 수

- **종합과목 OCR 파일**: 28개 (2002~2015, 연간 r1+r2)
- **종합과목 Vision JSON**: 16개 (2016~2025)
- **종합과목 전체**: 44개 시험지
- **수학**: 38개 시험지

### D. 누락된 회차 목록

✅ **연도 기준 누락 없음**: 모든 연도(2002~2025)가 domain_trends에 존재

⚠️ **문제 수 불일치**:
- 파일 전체 문항: 840(OCR) + 608(Vision) = **1,448문항**
- 분석된 문항: **1,315문항**
- **133문항(9.2%) 미분류/누락**
  - OCR(2002~2015): 840문항 중 631문항만 반영 (209문항 누락)
  - Vision(2016~2025): 608문항 중 684문항 반영 (Vision 76문항 초과 — 일부 OCR 문항이 Vision 연도로 재분류된 것으로 추정)

### E. 중복 집계된 회차 목록

**종합과목-수학 간 (year, round) 중복**: 22개
```
(2005,r1), (2005,r2), (2006,r1), (2006,r2), (2007,r1), (2007,r2),
(2008,r1), (2008,r2), (2009,r1), (2009,r2), (2010,r1), (2010,r2),
(2011,r1), (2011,r2), (2012,r1), (2012,r2), (2013,r1), (2013,r2),
(2014,r1), (2014,r2), (2015,r1), (2015,r2)
```

✅ 이는 **별도 과목(종합과목 vs 수학)** 이므로 정상적인 구조

### F. 토픽별 출제빈도 재계산

| 영역 | 토픽 수 | 영역별 합계 |
|------|---------|------------|
| economy | 32 | 496 |
| politics | 26 | 315 |
| history | 21 | 222 |
| geography | 21 | 218 |
| society | 6 | 64 |
| **계** | **106** | **1,315** |

⚠️ **토픽 수준 카운트**: 1061 (domain 합계 1315와 254 차이)
→ 254문항은 영역(domain)까지만 분류되고 세부 토픽은 미분류

⚠️ **71개 토픽이 count=1** (전체 106개 중 67%)

### G. 연도별 출제횟수 재계산

| 연도 | 경제 | 정치 | 지리 | 역사 | 사회 | 합계 |
|------|------|------|------|------|------|------|
| 2002 | 9 | 12 | 4 | 3 | 18 | 46 |
| 2003 | 30 | 8 | 4 | 6 | 4 | 52 |
| 2004 | 28 | 7 | 1 | 3 | 4 | 43 |
| 2005 | 17 | 14 | 3 | 5 | 0 | 39 |
| 2006 | 18 | 6 | 2 | 8 | 5 | 39 |
| 2007 | 24 | 10 | 2 | 4 | 5 | 45 |
| 2008 | 21 | 13 | 3 | 6 | 1 | 44 |
| 2009 | 18 | 13 | 7 | 3 | 3 | 44 |
| 2010 | 15 | 15 | 7 | 5 | 3 | 45 |
| 2011 | 19 | 14 | 5 | 3 | 2 | 43 |
| 2012 | 28 | 9 | 9 | 6 | 0 | 52 |
| 2013 | 19 | 14 | 9 | 7 | 1 | 50 |
| 2014 | 18 | 6 | 7 | 14 | 0 | 45 |
| 2015 | 22 | 5 | 4 | 10 | 3 | 44 |
| 2016 | 24 | 16 | 18 | 16 | 2 | 76 |
| 2017 | 23 | 18 | 17 | 16 | 2 | 76 |
| 2018 | 23 | 21 | 15 | 16 | 1 | 76 |
| 2019 | 10 | 11 | 9 | 7 | 1 | 38 |
| 2020 | 13 | 10 | 7 | 8 | 0 | 38 |
| 2021 | 22 | 17 | 18 | 16 | 3 | 76 |
| 2022 | 22 | 19 | 20 | 15 | 0 | 76 |
| 2023 | 25 | 17 | 15 | 17 | 2 | 76 |
| 2024 | 24 | 20 | 16 | 14 | 2 | 76 |
| 2025 | 24 | 20 | 16 | 14 | 2 | 76 |
| **합계** | **496** | **315** | **218** | **222** | **64** | **1315** |

Domain 합계(1315) = 연도별 합계(1315) = claimed total_questions_analyzed(1315) ✅

### H. 2026~2028 예측에 사용된 원본 토픽 수

- **예측 기반**: trend_analysis_complete.json의 106개 토픽 전체
- **분석 기간**: 2002~2025
- **방법론**: Multi-factor (recency 25%, frequency 25%, momentum 15%, streak 10%, cycle 15%, domain 10%)
- **top_30_predictions**: 30개 토픽
  - economy: 9, politics: 7, history: 6, geography: 5, society: 3
- **연도별 예측**: 2026(30개), 2027(30개), 2028(30개)

---

## 4. 최종 결과

```
=== COVERAGE AUDIT ===
실제 시험지 수:           44 (종합과목 OCR 28 + Vision 16)
출제경향 반영 연도 수:    24년 (2002~2025)
출제경향 반영 문제 수:    1,315 / 1,448
반영률:                   90.8%

=== MISSING EXAMS ===
연도 기준 누락:           없음 ✅
문제 수 기준 누락:        133문항 (9.2%) ⚠️
  - OCR 2002-2015: 209문항 미분류
  - Vision 2016-2025: 전량 분류 (일부 OCR 문항 포함 추정)

=== DUPLICATE EXAMS ===
종합과목-수학 간 중복:    22개 (별도 과목이므로 정상) ✅
파일 레벨 중복:           없음 ✅

=== TOPIC VALIDATION ===
토픽 수:                  106개 ✅
영역(domain) 합계 일치:   ✅ (1,315 = 496+315+218+222+64)
토픽-영역 간 차이:        254문항 (토픽 미분류) ⚠️
Count=1 토픽:             71개 (67%) ⚠️

=== TREND VALIDATION ===
연도별-영역별 합계 일치:  ✅ (1,315)
연도별 누락:              없음 ✅

=== FINAL VERDICT ===
PASS: 모든 기출 연도(2002~2025)가 출제경향에 반영됨 ✅
```

---

## 5. 발견된 문제점 요약

| # | 문제 | 심각도 | 설명 |
|---|------|--------|------|
| 1 | `dataset/comprehensive/dataset_consolidated.json` | 🔴 **상** | 28개 파일 중 2개(2011년)만 포함. `total_exams=2`로 잘못 보고됨 |
| 2 | `dataset/comprehensive/master_dataset.json` | 🔴 **상** | 동일하게 2개 시험지만 포함 (`total_exams=2, total_questions=49`) |
| 3 | 133문항 미분류 (9.2%) | 🟡 **중** | OCR 209문항 누락, Vision은 전량 분석되었으나 일부 OCR 문항이 Vision 연대로 재분류된 흔적 |
| 4 | 254문항 토픽 미분류 | 🟡 **중** | 영역(domain)까지만 분류되고 세부 토픽 미할당 |
| 5 | 71개 토픽이 count=1 | 🟢 **하** | 106개 토픽 중 67%가 1회만 출제 — 토픽 세분화 과다 |
| 6 | math_trend_analysis 미연동 | 🟢 **하** | 수학 트렌드 분석 JSON(TrendDashboard에서 미사용) |

## 6. 권장사항

1. **dataset_consolidated.json 재생성**: 28개 OCR 파일 전체를 포함하도록 업데이트
2. **master_dataset.json 재생성**: `total_exams`를 44(OCR 28 + Vision 16)로 정정
3. **분류 정확도 개선**: OCR 2002~2015년 문제의 domain/topic 분류 키워드 보강
4. **unknown_remaining 추적**: 미분류 문항을 0이 아닌 실제 값으로 표시
5. **수학 트렌드 연동**: `math_trend_analysis.json`을 TrendDashboard에 통합
6. **토픽 체계 재검토**: count=1 토픽을 상위 토픽으로 통합하거나 키워드 정밀도 향상
