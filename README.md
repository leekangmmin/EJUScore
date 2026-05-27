<div align="center">

# **EJU Score Tracker**

**일본유학시험 모의고사 점수 관리 + AI 기반 시험지 분석**

<br>

[![PWA Deploy](https://github.com/leekangmmin/EJUScore/actions/workflows/pwa-deploy.yml/badge.svg)](https://github.com/leekangmmin/EJUScore/actions/workflows/pwa-deploy.yml)
[![Build](https://github.com/leekangmmin/EJUScore/actions/workflows/build.yml/badge.svg)](https://github.com/leekangmmin/EJUScore/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/leekangmmin/EJUScore)](https://github.com/leekangmmin/EJUScore/releases)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<br>

[**웹 앱 열기**](https://leekangmmin.github.io/EJUScore/) · [**릴리즈 다운로드**](https://github.com/leekangmmin/EJUScore/releases) · PWA · iOS/Android/Desktop

</div>

<br>

---

<br>

## 바로 시작하기

```bash
git clone https://github.com/leekangmmin/EJUScore.git
cd EJUScore
npm install
npm run dev         # http://localhost:5173
npm run electron:dev  # Desktop app
```

| 플랫폼 | 설치 방법 |
|---|---|
| 🌐 **Web** | [leekangmmin.github.io/EJUScore](https://leekangmmin.github.io/EJUScore/) |
| 📱 **iOS** | Safari → 공유 → 홈 화면에 추가 |
| 🤖 **Android** | Chrome → 설치 |
| 💻 **Desktop** | [Releases](https://github.com/leekangmmin/EJUScore/releases) DMG 다운로드 |

<br>

---

<br>

## 무엇을 할 수 있나

### 📊 점수 트래킹
회차별 일본어·종합과목·수학 점수를 저장하고, 성장 추이를 LineChart로 확인. 3개월 예측, 회차 비교, D-day 알림.

### 🔍 AI 시험지 분석
시험지 스캔(JPG/PNG/PDF)을 올리면 4단계 async 파이프라인이 자동 분석.
- **Phase 1** 토큰 추출 — 파일명 + OCR(실제 Tesseract.js)로 과목 판별
- **Phase 2** Subject 격리 — 종합과목은 수식 차단, 수학만 LaTeX 정규화
- **Phase 3** 시러버스 매칭 — 코사인 유사도로 38문항 개별 매칭
- **Phase 4** 신뢰도 앙상블 — `P1×0.25 + P2×0.3 + P3×0.45`, <80% 자동 재검사

### 🧩 종합과목 38문항 Full Scan
지리(8) · 역사(8) · 정치(8) · 경제(8) · 사회(6) — 문항별 독립 키워드 매칭, 출제 빈도 가중치 반영, 자기 교정 모달.

### 🩺 오답 진단 리포트
4가지 오답 유형 분류 (개념 혼동 · 사료 해석 오류 · 그래프 오독 · 제도 이해 부족) + 맞춤 처방전.

### 📱 PWA · Desktop
Service Worker 오프라인 캐싱 + push 알림 + display: standalone. Electron macOS DMG 제공.

<br>

---

<br>

## 기술 스택

```
React 19 · Vite 8 · Recharts · KaTeX · Lucide React · Tailwind CSS
Electron 35 · electron-builder 25 · Tesseract.js · pdfjs-dist
GitHub Actions (Build + PWA Deploy + Release)
```

<br>

---

<br>

## 프로젝트 구조

```
src/
├── components/    Dashboard, EJU20YearTrend, DiagnosticReport, PhotoToQuestion, TrendDashboard
├── data/          ejuTrendData.js (출제 경향 통계)
├── utils/         storage, diagnosis, prediction, analytics
├── App.jsx        Routing + 전역 상태
└── main.jsx       PWA entry + SW 등록

public/
├── sw.js          Service Worker (cache-first + network-first)
├── manifest.json  PWA manifest
└── app-cover.svg  OG 이미지 / splash

electron/          Main process + preload + AI worker
.github/workflows/ CI/CD 파이프라인
```

<br>

---

<br>

## 로드맵

- [x] 점수 기록 + 대시보드 + 회차 비교
- [x] EJU 38문항 개별 분석 (Anti-Hallucination)
- [x] PWA + 오프라인 캐싱 + push 알림
- [x] macOS DMG 빌드 + 코드 서명
- [x] 모바일 반응형 UI
- [x] AI 오답 진단 리포트
- [x] 사진 → 문제 변환 (PhotoToQuestion)
- [x] 출제 경향 대시보드 (2002~2025 분석)
- [ ] 실제 OCR Tesseract.js 연동 개선
- [ ] Windows/Linux 빌드
- [ ] 사용자 계정 + 클라우드 동기화
- [ ] 일본어 UI

<br>

---

<br>

<div align="center">

MIT © 2025 **이강민 (Lee Kangmin)**

[GitHub](https://github.com/leekangmmin/EJUScore) · [Web App](https://leekangmmin.github.io/EJUScore/) · [Releases](https://github.com/leekangmmin/EJUScore/releases)

</div>
