# EJU OCR 추출 리포트

- 생성: 2026-06-03T21:28:56.135Z
- 입력 문서: **296** (과목: {"japanese":132,"comprehensive":82,"mathematics":82})
- 시험(exam) 그룹: **95** · 추출 문항: **1588**

## 1. 추출 성공률

- 問 분리: **1588/1588 (100%)** — 문제 문서 내 모든 問 마커 분리
- 보기(선택지) 추출: **373** 문항 (23%) — 숫자형 보기, OCR 노이즈로 일부만 복원
- Zod 검증 통과: 문항 **1588/1588**, 시험 **95/95**

## 2. 미분리 문제 수

- 問 마커 0개로 분리 실패한 문제 문서: **0/106**

## 3. 정답 연결 실패 수

- 연결 성공(linked): **204**
- 정답 문서 있으나 키 매칭 실패(missing): **1360**
- 정답 문서 없음(no_answer_doc): **24**
- 연결률(정답문서 보유 문항 기준): **13%**
  > ⚠️ 정직: 正解表 OCR이 격자·숫자뭉침으로 심하게 깨져 문항별 정답 추출 신뢰도가 낮음. 해당 정답 문서는 재OCR/수동입력 후보.

## 4. OCR 의심 구간

- ocrSuspect 플래그 문항: **114** (7%)
  - `japanese_2005_r1#問20@13` — long_run, repeated_ngram
  - `japanese_2005_r1#問3@14` — long_run, repeated_ngram
  - `japanese_2005_r1#問2@16` — long_run, repeated_ngram
  - `japanese_2005_r1#問20@13` — long_run, repeated_ngram
  - `japanese_2005_r1#問8@3` — long_run, repeated_ngram
  - `japanese_2005_r1#問20@12` — long_run, repeated_ngram
  - `japanese_2005_r1#問3@12` — long_run, repeated_ngram
  - `japanese_2005_r1#問3@12` — long_run, repeated_ngram

## 산출물

- `parsed_exams.json` · `parsed_questions.json` · `schema/*.schema.json`
> 점수·연결은 OCR 품질 한계 내 최선이며, 깨진 정답표는 재처리 후보로 분리 표기.