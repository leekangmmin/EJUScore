<div align="center">

<img src=".github/assets/icon.png" width="120" alt="EJU Score Tracker Icon" />

# EJU Score Tracker

**EJU(日本留学試験) 모의고사 점수 관리 macOS 앱**

[![License: MIT](https://img.shields.io/badge/License-MIT-4f8ef7?style=flat-square)](LICENSE)
[![macOS](https://img.shields.io/badge/macOS-12%2B-lightgrey?style=flat-square&logo=apple)](https://github.com/leekangmmin/EJUScore/releases)
[![GitHub release](https://img.shields.io/github/v/release/leekangmmin/EJUScore?style=flat-square&color=a855f7&label=Latest)](https://github.com/leekangmmin/EJUScore/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/leekangmmin/EJUScore/total?style=flat-square&color=10b981&label=Downloads)](https://github.com/leekangmmin/EJUScore/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/leekangmmin/EJUScore/build.yml?style=flat-square&label=Build)](https://github.com/leekangmmin/EJUScore/actions)

[**다운로드**](https://github.com/leekangmmin/EJUScore/releases/latest) · [기능 소개](#-기능) · [스크린샷](#%EF%B8%8F-스크린샷) · [개발자 가이드](#-개발)

</div>

---

## 소개

EJU Score Tracker는 일본 유학 시험(EJU) 모의고사 점수를 체계적으로 관리하기 위한 **macOS 네이티브 앱**입니다.

매달 보는 모의고사 결과를 기록하고 → 점수 추이를 시각화하며 → 오답을 분석해 취약 문제를 파악할 수 있습니다.

---

## ✨ 기능

| 기능 | 설명 |
|------|------|
| 📊 **점수 추이 그래프** | 월별 일본어·종합과목 점수 변화를 선형 차트로 시각화 |
| 📈 **성장률 & 예측선** | 직전 회차 대비 증감 표시, 선형 회귀 기반 3개월 예측 |
| 🎯 **목표 점수 설정** | 목표 점수 대비 달성률 진행 바 표시 |
| ⚠️ **오답 누적 경고** | N회 이상 반복 오답 문제 자동 감지 & 경보 |
| 🔥 **오답 히트맵** | 독해·청해 문제별 오답 빈도를 히트맵으로 시각화 |
| 📚 **종합과목 단원 분석** | 단원별 오답 유형(실수/정보부족/연계사고부족) 분류 및 우선순위 |
| 🌙 **다크/라이트 모드** | 시스템 테마에 맞춘 자유로운 전환 |
| 🖥️ **메뉴바 위젯** | 최신 점수를 macOS 메뉴바에 상시 표시 |

---

## 🖥️ 스크린샷

> 스크린샷은 추후 추가 예정입니다.

<!-- 스크린샷 추가 시 아래 형식 사용:
![대시보드](.github/assets/screenshot-dashboard.png)
![오답 분석](.github/assets/screenshot-analysis.png)
-->

---

## 📥 다운로드

### 최신 릴리즈 (권장)

1. [**Releases 페이지**](https://github.com/leekangmmin/EJUScore/releases/latest)에서 `EJUScore.app.zip` 다운로드
2. 압축 해제 후 `EJUScore.app`을 **응용 프로그램** 폴더로 이동
3. 처음 실행 시 **우클릭 → 열기** (Gatekeeper 우회)

> **시스템 요구사항:** macOS 12.0 Monterey 이상

---

## 📦 다운로드 현황

[![Total Downloads](https://img.shields.io/github/downloads/leekangmmin/EJUScore/total?style=for-the-badge&color=4f8ef7&label=Total%20Downloads)](https://github.com/leekangmmin/EJUScore/releases)
[![Latest Release Downloads](https://img.shields.io/github/downloads/leekangmmin/EJUScore/latest/total?style=for-the-badge&color=a855f7&label=Latest%20Release)](https://github.com/leekangmmin/EJUScore/releases/latest)

> 릴리즈별 상세 다운로드 현황은 [Releases](https://github.com/leekangmmin/EJUScore/releases) 탭에서 확인할 수 있습니다.

---

## 🛠 개발

### 필요 환경

- macOS 13+ (개발 환경)
- Xcode 15+
- Node.js 20+

### 로컬 실행

```bash
# 저장소 클론
git clone https://github.com/leekangmmin/EJUScore.git
cd EJUScore

# 웹 앱 개발 서버 실행
npm install
npm run dev
```

### 앱 빌드 (macOS .app)

```bash
# 1. React 빌드
npm run build

# 2. 웹 번들 복사
cp -r dist EJUScore/EJUScore/www

# 3. Xcode로 빌드
xcodebuild -project EJUScore/EJUScore.xcodeproj \
  -scheme EJUScore -configuration Release build
```

### 자동 빌드 (CI/CD)

`main` 브랜치에 push하면 GitHub Actions가 자동으로:
- React 앱 빌드
- macOS `.app` 빌드
- 아티팩트 저장 (30일 보관)

`v1.0.0` 형식의 태그를 push하면 자동으로 GitHub Release가 생성됩니다:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 🗂 프로젝트 구조

```
EJUScore/
├── src/                    # React 소스
│   ├── components/         # UI 컴포넌트
│   ├── utils/storage.js    # localStorage + 네이티브 브릿지
│   └── main.jsx
├── EJUScore/               # Xcode 프로젝트
│   └── EJUScore/
│       ├── AppDelegate.swift   # 메뉴바 위젯
│       ├── ContentView.swift   # WKWebView 래퍼
│       └── EJUScoreApp.swift
└── .github/workflows/      # GitHub Actions
```

---

## 📄 라이선스 & 저작권

```
Copyright (c) 2025 이강민 (Lee Kangmin)
github.com/leekangmmin

MIT License — 자유롭게 사용, 수정, 배포 가능합니다.
단, 원저작자 표기(이강민 / leekangmmin)를 유지해야 합니다.
```

[![License: MIT](https://img.shields.io/badge/License-MIT-4f8ef7?style=for-the-badge)](LICENSE)

---

<div align="center">
  <sub>Made with ☕ by <a href="https://github.com/leekangmmin">이강민 (leekangmmin)</a> · EJU 합격을 응원합니다 🎌</sub>
</div>
