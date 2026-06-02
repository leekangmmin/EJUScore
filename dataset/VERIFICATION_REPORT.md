# EJU 데이터셋 검증 보고서 (Verification Report)
**검증 시간**: 2026-06-02
**검증 방식**: 실제 파일 시스템 직접 검사 (코드/보고서 주장에 의존하지 않음)

---

## A. 디렉토리별 실제 파일 존재 여부

### 1. dataset/mathematics (수학)
| 항목 | 값 |
|------|-----|
| **파일 수** | 40개 |
| **총 크기** | 785.8 KB (804,616 bytes) |
| **마지막 수정** | 2026-06-02 07:07:42 |
| **exam JSON 수** | 38개 (2005~2025, 21개 학년) |
| **연도 범위** | 2005년 ~ 2025년 (R1/R2) |
| **비고** | 2019 R2, 2020 R1, 2024 R2, 2025 R2 누락 |

### 2. dataset/comprehensive (종합과목)
| 항목 | 값 |
|------|-----|
| **파일 수** | 30개 |
| **총 크기** | 12.3 MB (12,943,968 bytes) |
| **마지막 수정** | 2026-06-02 05:13:46 |
| **exam JSON 수** | 28개 (2002~2015, 14개 학년) |
| **연도 범위** | 2002년 ~ 2015년 (R1/R2) |

### 3. dataset/gold_standard (골드스탠다드)
| 항목 | 값 |
|------|-----|
| **파일 수** | 2개 |
| **총 크기** | 628.0 KB (643,058 bytes) |
| **마지막 수정** | 2026-06-02 07:01:32 |
| **파일 목록** | gold_standard.json, math_gold_standard.json |

### 4. dataset/trend-analysis (트렌드분석)
| 항목 | 값 |
|------|-----|
| **파일 수** | 4개 |
| **총 크기** | 261.3 KB (267,565 bytes) |
| **마지막 수정** | 2026-06-02 07:01:32 |
| **파일 목록** | math_trend_analysis.json, trend_analysis.json, trend_analysis_complete.json, trend_analysis_v2.json |

### 5. dataset/prediction (예측)
| 항목 | 값 |
|------|-----|
| **파일 수** | 5개 |
| **총 크기** | 97.8 KB (100,197 bytes) |
| **마지막 수정** | 2026-06-02 07:01:32 |
| **파일 목록** | math_prediction_2026_2028.json, math_weakness_connector.json, prediction_2026.json, prediction_2026_2028.json, weakness_connector.json |

### 6. dataset/knowledge-graph (지식그래프)
| 항목 | 값 |
|------|-----|
| **파일 수** | 3개 |
| **총 크기** | 144.1 KB (147,593 bytes) |
| **마지막 수정** | 2026-06-02 07:01:32 |
| **파일 목록** | knowledge_graph.json, knowledge_graph_v3.json, math_knowledge_graph.json |

### 7. dataset/difficulty (난이도)
| 항목 | 값 |
|------|-----|
| **파일 수** | 2개 |
| **총 크기** | 626.0 KB (641,039 bytes) |
| **마지막 수정** | 2026-06-02 07:01:32 |
| **파일 목록** | difficulty_database.json, math_difficulty_database.json |

---

## B. JSON 무결성 검사

| 검사 항목 | 결과 |
|-----------|------|
| **총 JSON 파일 수** | 86개 |
| **정상 파싱** | 86개 (100%) |
| **손상 파일** | 0개 |
| **빈 파일** | 0개 |

✅ **모든 JSON 파일이 정상적으로 파싱됩니다. 손상이나 빈 파일은 없습니다.**

---

## C. 문항 수 집계

### 수학 (Mathematics)
| 항목 | 실제 값 |
|------|---------|
| **시험지 수** | 38개 |
| **총 문항 수** | **697문항** |
| **연도별 문항** | 2005:39, 2006:39, 2007:40, 2008:36, 2009:36, 2010:38, 2011:33, 2012:30, 2013:30, 2014:36, 2015:36, 2016:37, 2017:37, 2018:36, 2019:20, 2020:18, 2021:36, 2022:37, 2023:41, 2024:20, 2025:18 |

### 종합과목 (Comprehensive)
| 항목 | 실제 값 |
|------|---------|
| **시험지 수** | 28개 |
| **총 문항 수** | **840문항** |
| **연도별 문항** | 2002:92, 2003:94, 2004:84, 2005:42, 2006:48, 2007:48, 2008:51, 2009:50, 2010:51, 2011:49, 2012:65, 2013:58, 2014:57, 2015:51 |

### 총계
| 구분 | 문항 수 |
|------|---------|
| **수학** | 697문항 |
| **종합과목** | 840문항 |
| **합계** | **1,537문항** |
| **총 시험지 수** | **66개** |

---

## D. 보고서 주장 검증 (CLAIM VERIFICATION)

| CLAIM | ACTUAL FILE STATUS | VERDICT |
|-------|-------------------|---------|
| **수학 711문항 구축 완료** | 실제 38개 시험지 total_questions 합계 = **697문항** | **FALSE** |
| **수학 JSON 38개 생성 완료** | dataset/mathematics 내 exam_*.json = **38개 파일** | **TRUE** |
| **knowledge_graph_v3.json 존재** | 존재, 85,893 bytes, JSON 유효 | **TRUE** |
| **math_knowledge_graph.json 존재** | 존재, 6,782 bytes, JSON 유효 | **TRUE** |
| **trend_analysis_complete.json 존재** | 존재, 170,470 bytes, JSON 유효 | **TRUE** |
| **math_trend_analysis.json 존재** | 존재, 10,182 bytes, JSON 유효 | **TRUE** |
| **prediction_2026_2028.json 존재** | 존재, 62,371 bytes, JSON 유효 | **TRUE** |
| **math_prediction_2026_2028.json 존재** | 존재, 10,830 bytes, JSON 유효 | **TRUE** |
| **weakness_connector.json 존재** | 존재, 10,021 bytes, JSON 유효 | **TRUE** |
| **math_weakness_connector.json 존재** | 존재, 3,532 bytes, JSON 유효 | **TRUE** |

---

## E. 추가 발견된 데이터 불일치 (Additional Discrepancies)

### ⚠️ 발견된 주요 문제 7건

#### 1. 수학 Consolidated 파일 문항 수 과장 (Critical)
- **주장**: `dataset_consolidated.json` → total_questions = **711**
- **실제**: 38개 exam 파일의 `total_questions` 필드 합계 = **697**
- **차이**: **+18문항** 과다 계상
- **원인**: 5개 파일의 consolidated 항목이 실제와 다름:
  | 파일 | Consolidated 주장 | 실제 |
  |------|:---:|:---:|
  | 2011_r2 | 18 | 15 |
  | 2012_r1 | 18 | 15 |
  | 2012_r2 | 18 | 15 |
  | 2013_r1 | 20 | 15 |
  | 2013_r2 | 19 | 15 |

#### 2. 종합과목 Consolidated 파일 심각하게 구식 (Critical)
- **주장**: `dataset_consolidated.json` → 2개 시험, 49문항, 2011년만
- **실제**: 28개 시험 파일 (2002~2015), **840문항**
- **상태**: 데이터가 추가된 후 Consolidated 파일이 재생성되지 않음

#### 3. 종합과목 master_dataset.json도 구식
- `master_dataset.json`도 2개 시험(2011)만 기록, 840문항의 실제 데이터와 불일치

#### 4. 수학 Validation Report 부정확
- `reports/validation_report.json` → total_questions = **77**
- 실제 수학 문항 수 = 697 (완전히 다른 counting method)

#### 5. math_gold_standard.json도 711 주장
- `math_gold_standard.json` → total_questions = **711**
- 실제 수학 문항 수 = 697 → 14문항 과다

#### 6. math_difficulty_database.json도 711 주장
- `math_difficulty_database.json` → total_questions = **711**
- 실제 수학 문항 수 = 697

#### 7. 종합과목 골드스탠다드는 608문항
- `gold_standard.json` → total_questions = **608**
- 실제 종합과목 = 840문항 → 232문항 차이 (gold_standard는 2016-2025만 포함)

---

## F. 요약 및 권장사항

### 요약
- **파일 존재**: ✅ 모든 주장 파일이 실제로 존재함
- **JSON 무결성**: ✅ 86개 JSON 모두 정상 파싱
- **문항 수**: ❌ 주장(711) ≠ 실제(697), 차이 18문항
- **종합과목 메타데이터**: ❌ Consolidated/master 파일이 28개 시험 중 2개만 반영

### 권장사항
1. **dataset_consolidated.json (`math`)** 의 `total_questions`를 **697**로 수정하고 잘못된 5개 항목 수정
2. **dataset/comprehensive/dataset_consolidated.json** 전체 재생성 (28개 시험, 840문항 반영)
3. **master_dataset.json** 재생성
4. **math_gold_standard.json** 의 `total_questions`를 697로 조정
5. **math_difficulty_database.json** 의 항목 수 일치 확인
6. **validation_report.json** (total_questions=77) 수정 또는 용도 명확히 문서화
