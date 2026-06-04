<div align="center">

# 📘 EJU 인텔리전스

### 일본유학시험(EJU) 기출 20년을 분석해, **뭘 먼저 공부할지** 알려주는 학습 도구

한국인 유학생을 위한 **종합과목·수학 기출 분석 · 출제경향 · 약점 진단 · 사진→문제 변환 · 자연어 검색**

<br>

[![바로 써보기](https://img.shields.io/badge/🚀_바로_써보기-3182f6?style=for-the-badge)](https://leekangmmin.github.io/EJUScore/)
&nbsp;
[![소개 페이지](https://img.shields.io/badge/✨_소개_페이지-1b64da?style=for-the-badge)](https://leekangmmin.github.io/EJUScore/landing.html)

![PWA](https://img.shields.io/badge/PWA-설치형_웹앱-6366f1)
![Platform](https://img.shields.io/badge/iPhone·iPad·Android·Desktop-지원-191f28)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## ✨ 이런 걸 할 수 있어요

| | 기능 | 설명 |
|---|---|---|
| 📊 | **20년 출제경향** | 영역·토픽별 출제 빈도와 흐름을 연도별로. 어떤 주제가 꾸준히 나오는지 한눈에. |
| 🎯 | **출제 가능성 + 근거** | "무조건 나온다"가 아니라 **가능성·신뢰도·근거**를 함께. 불확실성까지 솔직하게 표시. |
| 🧩 | **출제경향 × 내 약점** | 자주 나오는데 내가 약한 주제 = 최우선 학습. 오답노트와 연결해 우선순위를 매김. |
| 📷 | **사진 → 문제 변환** | 문제집을 찍으면 텍스트로(OCR). 오답을 빠르게 기록하고 분석으로 연결. |
| 🔍 | **자연어 기출 검색** | "브레튼우즈 체제", "벡터 내적"처럼 한국어로 검색하면 관련 기출·출제년도·개념을 탐색. |
| 📈 | **점수 추적 · D-day** | 모의고사 점수 추이와 시험까지 남은 날, 번아웃·페이스 관리. |

> 분석 기반: EJU 종합과목·수학 기출 **2002–2025** · OCR 분석 시험지 **296개** · 구조화 문항 **1,448+** · 종합 **5개 영역**.

<div align="center">

### 👉 [지금 바로 써보기](https://leekangmmin.github.io/EJUScore/) &nbsp;·&nbsp; [소개 페이지 보기](https://leekangmmin.github.io/EJUScore/landing.html)

</div>

---

## 🚀 3단계면 끝

1. **점수·오답 입력** — 모의고사 점수나 틀린 문제를 기록 (사진 OCR도 가능)
2. **경향 × 약점 분석** — 20년 출제경향과 내 약점을 겹쳐 우선순위 자동 계산
3. **오늘 뭘 풀지 확인** — 예상 토픽·우선 학습 주제를 보고 바로 공부 시작

설치 없이 웹에서 바로 쓰거나, **홈 화면에 추가(PWA)**하면 앱처럼 오프라인에서도 동작해요.

---

## ⚠️ 정직 고지

- 출제 가능성·예측은 **과거 기출 데이터 기반 참고 지표**이며 실제 출제를 보장하지 않습니다.
- **공식 정답률 데이터는 제공하지 않습니다**(해당 데이터가 존재하지 않음). 난이도는 추정치, 정답률은 본인 오답 기록 기반입니다.
- 일부 문항은 분류 신뢰도가 낮아 **"미분류"**로 정직하게 표시됩니다 — 틀린 라벨을 지어내지 않습니다.
- 일본어 과목은 현재 문제 코퍼스가 없어 검색 결과가 표시되지 않습니다.

---

<details>
<summary><b>🛠 개발자용 (스택 · 빌드 · 테스트)</b></summary>

**스택:** React 19 · Vite · Electron 35 · PWA · vitest · `@huggingface/transformers`(로컬 OCR/분석)

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드 (dist/)
npm test           # vitest
npm run data:gate  # 데이터 품질 게이트 (CI)
npm run deploy     # GitHub Pages 배포 (gh-pages)
```

- 데이터 정본(canonical): `public/dataset/canonical/parsed_questions.json`
- 데이터 흐름·검증·수리 리포트: `DATA_FLOW_AUDIT.md`, `MIGRATION_VERIFICATION.md`, `FINAL_DATA_REPAIR_REPORT.md`
- 관리자 검수 콘솔: 앱에서 `#/admin/dashboard`

</details>

---

<div align="center">

MIT © 2025 **이강민 (Lee Kangmin)** · 한국인 유학생을 위한 EJU 분석 도구

</div>
