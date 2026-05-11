<div align="center">

<img src=".github/assets/icon.png" width="100" alt="EJU Score Tracker" />

# EJU Score Tracker

**EJU(日本留学試験) 모의고사 점수 관리 앱 for macOS**

[![License: MIT](https://img.shields.io/badge/License-MIT-4f8ef7?style=flat-square)](LICENSE)
[![macOS](https://img.shields.io/badge/macOS-12%2B-lightgrey?style=flat-square&logo=apple)](https://github.com/leekangmmin/EJUScore/releases)
[![Latest](https://img.shields.io/github/v/release/leekangmmin/EJUScore?style=flat-square&color=a855f7&label=Latest)](https://github.com/leekangmmin/EJUScore/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/leekangmmin/EJUScore/total?style=flat-square&color=10b981)](https://github.com/leekangmmin/EJUScore/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/leekangmmin/EJUScore/build.yml?style=flat-square)](https://github.com/leekangmmin/EJUScore/actions)

[**📥 다운로드**](https://github.com/leekangmmin/EJUScore/releases/latest) · [✨ 기능](#-기능) · [🛠 개발](#-개발)

</div>

---

## 소개

매달 보는 EJU 모의고사 결과를 기록하고, 점수 추이를 시각화하며, 오답 패턴을 분석해 취약점을 파악하는 **macOS 네이티브 앱**입니다.

---

## ✨ 기능

| | 기능 | 설명 |
|---|------|------|
| 📊 | **점수 추이 그래프** | 월별 일본어·종합과목 점수 변화를 선형 차트로 시각화 |
| 📈 | **성장률 & 예측선** | 직전 회차 대비 증감 표시, 선형 회귀 기반 3개월 예측 |
| 🎯 | **목표 점수 설정** | 목표 대비 달성률 진행 바 · 목표 달성 타임라인 |
| ⚠️ | **오답 누적 경고** | N회 이상 반복 오답 문제 자동 감지 & 경보 |
| 🔥 | **오답 히트맵** | 독해·청해 문제별 오답 빈도를 히트맵으로 시각화 |
| 🩺 | **약점 자동 진단** | 오답 패턴 분석 기반 맞춤 학습 조언 |
| 📚 | **종합과목 단원 분석** | 단원별 오답 유형(실수/정보부족/연계사고부족) 분류 |
| ⚖️ | **회차별 비교** | 두 회차를 나란히 비교해 성장 확인 |
| 🌙 | **다크/라이트 모드** | 시스템 테마에 맞춘 자유로운 전환 |
| 🖥️ | **메뉴바 위젯** | 최신 점수를 macOS 메뉴바에 상시 표시 |
| ⚡ | **빠른 입력** | 대시보드에서 점수를 즉시 기록 |
| 📖 | **문제집 기록** | 모의고사 외 문제집 풀이 결과도 별도 기록 |

---

## 📥 다운로드

1. [**Releases 페이지**](https://github.com/leekangmmin/EJUScore/releases/latest)에서 `EJUScore.app.zip` 다운로드
2. 압축 해제 후 `EJUScore.app`을 **응용 프로그램** 폴더로 이동
3. 처음 실행 시 **우클릭 → 열기** (Gatekeeper 우회)

> **시스템 요구사항:** macOS 12.0 Monterey 이상

[![Total Downloads](https://img.shields.io/github/downloads/leekangmmin/EJUScore/total?style=for-the-badge&color=4f8ef7&label=Total%20Downloads)](https://github.com/leekangmmin/EJUScore/releases)
[![Latest Release](https://img.shields.io/github/downloads/leekangmmin/EJUScore/latest/total?style=for-the-badge&color=a855f7&label=Latest%20Release)](https://github.com/leekangmmin/EJUScore/releases/latest)

---

## 🛠 개발

**요구사항:** Xcode 15+ · Node.js 20+

```bash
# 저장소 클론
git clone https://github.com/leekangmmin/EJUScore.git
cd EJUScore

# 개발 서버 실행
npm install
npm run dev
```

### 앱 빌드 (macOS .app)

```bash
# 1. React 빌드
npm run build

# 2. 웹 번들 복사
cp -r dist EJUScore/EJUScore/www

# 3. Xcode 빌드
xcodebuild -project EJUScore/EJUScore.xcodeproj \
  -scheme EJUScore -configuration Release build
```

### CI/CD

`main` 브랜치 push → GitHub Actions가 자동으로 React + macOS 앱 빌드 및 아티팩트 저장

버전 태그 push → GitHub Release 자동 생성

```bash
git tag v1.2.1
git push origin v1.2.1
```

---

## 🗂 프로젝트 구조

```
EJUScore/
├── src/
│   ├── components/         # Dashboard, ScoreForm, Analysis 등
│   ├── utils/
│   │   ├── storage.js      # localStorage + 네이티브 브릿지
│   │   ├── diagnosis.js    # 약점 자동 진단
│   │   └── scorePrediction.js  # 점수 예측 엔진
│   └── main.jsx
├── EJUScore/               # Xcode 프로젝트 (Swift)
│   └── EJUScore/
│       ├── AppDelegate.swift   # 메뉴바 위젯
│       ├── ContentView.swift   # WKWebView 래퍼
│       └── EJUScoreApp.swift
└── .github/workflows/      # GitHub Actions
```

---

## 📄 라이선스

```
Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin
MIT License
```

---

<div align="center">
  <sub>Made with ☕ by <a href="https://github.com/leekangmmin">이강민 (leekangmmin)</a> · EJU 합격을 응원합니다 🎌</sub>
</div>
