<div align="center">

<!-- 헤더 배너 -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:07070e,50:1a1a2e,100:f0a030&height=200&section=header&text=EJU%20Score%20Tracker&fontSize=48&fontColor=f0a030&fontAlignY=38&desc=일본유학시험%20모의고사%20점수%20관리%20%2B%20AI%20기반%20시험지%20분석&descSize=16&descAlignY=58&descColor=ffffff60" />

<!-- 타이핑 애니메이션 -->
<img src="https://readme-typing-svg.demolab.com?font=Syne&weight=700&size=18&pause=1000&color=F0A030&center=true&vCenter=true&width=640&lines=PWA+%C3%97+Electron+%C3%97+React+19;CLAHE%2FSauvola+%EC%A0%84%EC%B2%98%EB%A6%AC+%E2%86%92+Tesseract.js+OCR;38%EB%AC%B8%ED%95%AD+%EC%A2%85%ED%95%A9%EA%B3%BC%EB%AA%A9+%EC%99%84%EC%A0%84+%EB%B6%84%EC%84%9D;Qwen2.5-0.5B+%EB%A1%9C%EC%BB%AC+AI+%EA%B0%9C%EB%85%90+%EB%B6%84%EC%84%9D;Win+%2F+Linux+%2F+macOS+Desktop+%EB%B9%8C%EB%93%9C" alt="Typing SVG" />

<br/>

[![PWA Deploy](https://github.com/leekangmmin/EJUScore/actions/workflows/pwa-deploy.yml/badge.svg)](https://github.com/leekangmmin/EJUScore/actions/workflows/pwa-deploy.yml)
[![Build](https://github.com/leekangmmin/EJUScore/actions/workflows/build.yml/badge.svg)](https://github.com/leekangmmin/EJUScore/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/leekangmmin/EJUScore?color=f0a030&label=Release)](https://github.com/leekangmmin/EJUScore/releases)
[![License](https://img.shields.io/badge/License-MIT-f0a030.svg)](LICENSE)

<br/>

**웹 앱** · [`leekangmmin.github.io/EJUScore`](https://leekangmmin.github.io/EJUScore/) · PWA · iOS / Android / Desktop

</div>

---

## 🛠 Stack

![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)
![Tesseract.js](https://img.shields.io/badge/Tesseract.js-00BFFF?style=for-the-badge&logo=tesseract&logoColor=white)
![HuggingFace](https://img.shields.io/badge/🤗%20Transformers-FFD21E?style=for-the-badge&logoColor=black)
![Recharts](https://img.shields.io/badge/Recharts-FF6B6B?style=for-the-badge&logo=recharts&logoColor=white)

---

## 📦 Features

### 📊 점수 트래킹 & 대시보드
회차별 일본어·종합과목·수학 점수를 저장하고 성장 추이를 LineChart로 확인. 3개월 예측, 회차 비교, D-day 알림.

### 🔍 AI 시험지 OCR 분석
시험지 스캔 (JPG / PNG / PDF) 업로드 시 4단계 파이프라인이 자동 분석

| Phase | 내용 | 방식 |
|-------|------|------|
| **1** | 토큰 추출 + 과목 판별 | Tesseract.js 실제 OCR / 파일명 메타 |
| **2** | Subject 격리 | 종합과목은 수식 완전 차단 |
| **3** | 시러버스 매칭 | 코사인 유사도 × 38문항 개별 매칭 |
| **4** | 신뢰도 앙상블 | `P1×0.25 + P2×0.3 + P3×0.45`, <80% 자동 재검사 |

### 📷 PhotoToQuestion — 사진 → 문제 변환 + AI 개념 분석
틀린 문제 사진을 업로드하면 5단계 파이프라인이 자동으로 처리합니다

| Step | 처리 | 설명 |
|------|------|------|
| **1** | Grayscale | 지각적 밝기 변환 (0.299R+0.587G+0.114B) |
| **2** | 히스토그램 스트레치 | 1%–99% 퍼센타일 클리핑 기반 대비 향상 |
| **3** | Sauvola 이진화 | 적분 이미지 최적화, k=0.15, R=128, w=25 |
| **4** | Tesseract.js OCR | `jpn+eng` 동시 인식, PSM 6, 단어 레벨 신뢰도 |
| **5** | AI 개념 분석 | Qwen2.5-0.5B 로컬 추론 (Electron IPC / WebGPU) |

### 🧩 종합과목 38문항 Full Scan
지리(8) · 역사(8) · 정치(8) · 경제(8) · 사회(6) — 문항별 독립 키워드 매칭, 출제 빈도 가중치 반영, 자기 교정 모달

### 🩺 오답 진단 리포트
4가지 오답 유형 (개념 혼동 · 사료 해석 오류 · 그래프 오독 · 제도 이해 부족) 분류 + 맞춤 처방전

### 📱 PWA + Desktop
Service Worker 오프라인 캐싱 · push 알림 · `display: standalone` · Electron macOS/Windows/Linux 빌드

---

## 🚀 Quick Start

```bash
git clone https://github.com/leekangmmin/EJUScore.git
cd EJUScore
npm install
npm run dev          # http://localhost:5173
npm run electron:dev # Desktop app
```

| Platform | Install |
|----------|---------|
| 🌐 **Web** | [leekangmmin.github.io/EJUScore](https://leekangmmin.github.io/EJUScore/) |
| 📱 **iOS** | Safari → 공유 → 홈 화면에 추가 |
| 🤖 **Android** | Chrome → 설치 |
| 💻 **macOS** | [Releases](https://github.com/leekangmmin/EJUScore/releases) — `.dmg` (arm64 / x64) |
| 🪟 **Windows** | [Releases](https://github.com/leekangmmin/EJUScore/releases) — NSIS Installer (x64) |
| 🐧 **Linux** | [Releases](https://github.com/leekangmmin/EJUScore/releases) — `.AppImage` / `.deb` |

---

## 🤖 로컬 AI 개념 분석

OCR 완료 후 **AI 개념 분석** 버튼으로 완전 오프라인 LLM 분석을 실행합니다.

| 환경 | AI 엔진 | 추론 방식 |
|------|---------|----------|
| **Electron** (macOS/Win/Linux) | Qwen2.5-0.5B-Instruct (q4) | Main Process Worker Thread (IPC), 스트리밍 |
| **Web / PWA** | @huggingface/transformers | Web Worker + WebGPU / WASM 폴백 |

분석 항목: **핵심 개념** · **자주 틀리는 포인트** · **학습 권장사항** — 전부 로컬 처리, 서버 전송 없음

---

## 📁 Structure

```
src/
├── components/     Dashboard, EJU20YearTrend, DiagnosticReport, PhotoToQuestion, TrendDashboard
├── workers/        aiAnalysisWorker.js (Web Worker — Qwen2.5 브라우저 추론)
├── data/           ejuTrendData.js (2002~2025 출제 경향)
├── utils/          storage, diagnosis, prediction, analytics
├── App.jsx         Routing + 전역 상태
└── main.jsx        PWA entry + SW 등록

electron/           Main process + preload.cjs + aiWorker.js (Node Worker Thread)
public/             sw.js · manifest.json · app-cover.svg
.github/workflows/  CI/CD (Build + PWA Deploy + Release)
```

---

## 🗺 Roadmap

- [x] 점수 기록 + 대시보드 + 회차 비교
- [x] EJU 38문항 개별 분석 (Anti-Hallucination)
- [x] PWA + 오프라인 캐싱 + push 알림
- [x] macOS DMG 빌드 + 코드 서명
- [x] 모바일 반응형 UI
- [x] AI 오답 진단 리포트
- [x] 사진 → 문제 변환 (PhotoToQuestion)
- [x] 출제 경향 대시보드 (2002~2025)
- [x] Windows / Linux 빌드 (NSIS Installer / AppImage / deb)
- [x] OCR 전처리 파이프라인 고도화 (Sauvola 적응형 이진화 + 히스토그램 스트레치)
- [x] 로컬 AI 개념 분석 (Qwen2.5-0.5B — Electron IPC + Web Worker 이중 구조)
- [ ] 사용자 계정 + 클라우드 동기화
- [ ] 日本語 UI

---

<div align="center">

<!-- GitHub 통계 -->
<img height="160" src="https://github-readme-stats.vercel.app/api/pin/?username=leekangmmin&repo=EJUScore&theme=dark&bg_color=07070e&title_color=f0a030&icon_color=f0a030&text_color=e0e0f0&border_color=26263c" />

<br/><br/>

MIT © 2025 **이강민 (Lee Kangmin)**

[GitHub](https://github.com/leekangmmin/EJUScore) · [Web App](https://leekangmmin.github.io/EJUScore/) · [Releases](https://github.com/leekangmmin/EJUScore/releases)

<!-- 푸터 -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:f0a030,50:1a1a2e,100:07070e&height=100&section=footer" />

</div>
