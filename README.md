<div align="center">

# EJU Score Tracker

**EJU(日本留学試験 / 일본유학시험) 모의고사 점수 AI 분석 · 관리 앱**

[![PWA Deploy](https://github.com/leekangmmin/EJUScore/actions/workflows/pwa-deploy.yml/badge.svg)](https://github.com/leekangmmin/EJUScore/actions/workflows/pwa-deploy.yml)
[![Build](https://github.com/leekangmmin/EJUScore/actions/workflows/build.yml/badge.svg)](https://github.com/leekangmmin/EJUScore/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/leekangmmin/EJUScore?style=social)](https://github.com/leekangmmin/EJUScore/stargazers)

### 🌐 [https://leekangmmin.github.io/EJUScore/](https://leekangmmin.github.io/EJUScore/) ← 아이폰/안드로이드/PC에서 즉시 사용

---

</div>

## 📋 개요

**EJU Score Tracker**는 **EJU(일본유학시험 / 日本留学試験)** 모의고사 점수를 체계적으로 관리하고 **AI가 분석**해주는 **올인원 웹앱(PWA)** 입니다.

일본 대학교(동경대, 교토대, 와세다대, 게이오대 등) 입시를 준비하는 유학생이라면 누구나 **무료**로 사용할 수 있으며, 아이폰(iOS), 안드로이드, Windows, macOS 어디서든 설치 없이(또는 PWA로 설치하여) 실행할 수 있습니다.

---

## ✨ 주요 기능

### 📊 EJU 점수 관리 & 성장 추적
| 기능 | 설명 |
|------|------|
| **점수 기록** | EJU 일본어(독해/청해) + 종합과목 + 수학 점수 입력 및 저장 |
| **성장률 그래프** | LineChart 기반 점수 변화 추이 시각화, 3개월 예측선 제공 |
| **회차별 비교** | 두 시험 성적을 나란히 비교하는 분석 |
| **통계 대시보드** | 평균, 최고점, 최저점, 표준편차, 목표 달성률 한눈에 확인 |

### 🤖 AI 오답 진단
- EJU 종합과목 **38문항**(지리 8문항 + 역사 8문항 + 정치 8문항 + 경제 8문항 + 사회 6문항) 각각에 대해 AI가 오답 원인 분석
- **4가지 오답 유형** 자동 분류: 개념 혼동, 사료 해석 오류, 그래프 변곡점 오판, 제도 구조 이해 부족
- 오답 마인드맵 + 우선순위별 처방전 생성

### 📈 EJU 20개년 기출 트렌드 AI 분석
- **2006년~2025년** 20년간 EJU 종합과목 + 수학 코스1 기출 데이터
- **4단계 AI OCR 파이프라인**: 토큰 추출 → LaTeX AST → 코사인 유사도 시러버스 매칭 → 신뢰도 앙상블
- **38문항 전수 스캔**: 종합과목 파일 업로드 시 38개 문항 각각에 대한 개별 분석
- **과목별 빈출 테마 가중치 카드** 제공
- **자가 교정 엔진**: 신뢰도 85% 미만 시 사용자 피드백 모달

### 🔔 EJU D-day 알림
- 시험일 등록 시 **D-7, D-3, D-1, D-day** 푸시 알림
- PWA 설치 시 앱이 실행 중이 아니어도 알림 도착

### 📱 크로스 플랫폼 PWA
| 플랫폼 | 설치 방법 |
|--------|----------|
| **iOS (iPhone/iPad)** | Safari → 공유 버튼 → "홈 화면에 추가" |
| **Android** | Chrome → 메뉴 → "앱 설치" 또는 "홈 화면에 추가" |
| **Windows** | Edge/Chrome → 메뉴 → "EJU Score Tracker 설치..." |
| **macOS** | Chrome/Safari → 메뉴 → 설치 |
| **모든 플랫폼** | **https://leekangmmin.github.io/EJUScore/** 에서 즉시 사용 가능 |

- Service Worker 기반 **오프라인 캐싱** 지원
- **푸시 알림** (D-day, 학습 리마인더)
- **독립 실행형** (display: standalone) — 브라우저 URL창 없는 앱 모드

---

## 🚀 지금 바로 사용하기

### 웹앱 (설치 불필요)
```
https://leekangmmin.github.io/EJUScore/
```

### PWA로 설치 (앱처럼 실행)
1. Safari/Chrome/Edge로 위 URL 접속
2. 브라우저 메뉴에서 **"홈 화면에 추가"** 또는 **"앱으로 설치"** 선택
3. 홈 화면/시작 메뉴의 아이콘으로 실행

---

## 🛠 기술 스택

| 분야 | 기술 |
|------|------|
| **프론트엔드** | React 19, Vite 8, Tailwind CSS |
| **PWA** | Service Worker, Web App Manifest, Push API |
| **시각화** | Recharts (LineChart, PieChart) |
| **아이콘** | Lucide React |
| **수식** | KaTeX (LaTeX 렌더링) |
| **애니메이션** | Framer Motion |
| **데스크톱** | Electron + electron-builder |
| **macOS 네이티브** | Xcode + Swift (WKWebView) |
| **CI/CD** | GitHub Actions |

---

## 💻 개발 환경

```bash
# 클론
git clone https://github.com/leekangmmin/EJUScore.git
cd EJUScore

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드 (PWA)
npm run build

# Electron 데스크톱 앱 실행
npm run electron:dev
```

### 프로젝트 구조
```
EJUScore/
├── src/
│   ├── components/         # React 컴포넌트 (Dashboard, EJU20YearTrend, InstallGuide, DiagnosticReport 등)
│   ├── utils/              # storage.js, diagnosis.js, scorePrediction.js, analytics.js, taskEngine.js
│   └── main.jsx            # 앱 진입점 + Service Worker 등록
├── public/
│   ├── manifest.json       # PWA 매니페스트
│   ├── sw.js               # Service Worker (오프라인 캐싱, 푸시 알림)
│   ├── robots.txt          # 검색 엔진 크롤링 허용
│   ├── sitemap.xml         # Google Sitemap
│   └── 404.html            # GitHub Pages SPA 리디렉트
├── .github/workflows/      # GitHub Actions (Build, PWA Deploy, Release)
└── index.html              # SEO 최적화 (OG, Twitter Card, JSON-LD, FAQ Schema, 200+ 키워드)
```

---

## 📦 다운로드

### macOS 네이티브 앱
- **요구사항:** macOS 12.0 Monterey 이상
- [최신 macOS 앱 다운로드](https://github.com/leekangmmin/EJUScore/releases/latest)

### PWA (모든 플랫폼)
- 별도 다운로드 불필요 — **https://leekangmmin.github.io/EJUScore/** 에서 바로 사용
- Safari/Chrome에서 "홈 화면에 추가" 시 앱처럼 실행 가능

---

## 📈 검색 키워드

EJU, EJU점수, EJU모의고사, EJU시험, EJU일본어, EJU종합과목, EJU수학, 일본유학시험, 일본유학, 일본대학입시, 일본어독해, 일본어청해, JLPT, 종합과목, EJU기출문제, EJU기출트렌드, EJU20개년, 모의고사점수관리, 오답AI진단, 일본대학교, 동경대, 도쿄대, 교토대, 와세다, 게이오, PWA, 프로그레시브웹앱, EJU스코어, EJU Score Tracker, 일본유학준비, 유학시험앱.

---

## ⭐ 기여하기

이 프로젝트가 도움이 되셨다면 **GitHub Star**를 눌러주세요!  
버그 제보, 기능 제안, 풀 리퀘스트는 언제나 환영합니다.

[![GitHub stars](https://img.shields.io/github/stars/leekangmmin/EJUScore)](https://github.com/leekangmmin/EJUScore/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/leekangmmin/EJUScore)](https://github.com/leekangmmin/EJUScore/issues)

---

## 📄 라이선스

MIT License. Copyright (c) 2025 **이강민 (Lee Kangmin)** — [github.com/leekangmmin](https://github.com/leekangmmin)
