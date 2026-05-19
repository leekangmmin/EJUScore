<div align="center">

<img src=".github/assets/icon.png" width="100" alt="EJU Score Tracker" />

# EJU Score Tracker

**EJU(日本留学試験) 모의고사 점수 관리 앱 for macOS**

[최신 버전 다운로드](https://github.com/leekangmmin/EJUScore/releases/latest) · [모든 릴리스](https://github.com/leekangmmin/EJUScore/releases)

</div>

---

## 소개

매달 보는 EJU 모의고사 결과를 기록하고, 점수 추이를 시각화하며, 오답 패턴을 분석해 취약점을 파악하는 macOS 네이티브 앱입니다.

---

## 기능

### 대시보드 & 시각화

* 월별 일본어·종합과목 점수 변화를 선형 차트로 시각화합니다.
* 직전 회차 대비 증감을 표시하고, 선형 회귀 기반 3개월 예측선을 제공합니다.
* 목표 점수 대비 달성률을 진행 바와 타임라인으로 확인할 수 있습니다.
* 두 회차를 나란히 비교해 성장 추이를 확인하는 회차별 비교 기능을 지원합니다.

### 오답 패턴 분석

* N회 이상 반복된 오답 문제를 자동으로 감지해 경고를 표시합니다.
* 독해·청해 문제별 오답 빈도를 히트맵으로 시각화합니다.
* 오답 패턴 분석을 기반으로 취약 영역과 맞춤 학습 방향을 진단합니다.
* 종합과목 단원별로 오답 유형(실수 / 정보 부족 / 연계 사고 부족)을 분류합니다.

### 편의 기능

* macOS 메뉴바에 최신 점수를 상시 표시하는 위젯을 제공합니다.
* 대시보드에서 점수를 즉시 기록하는 빠른 입력을 지원합니다.
* 모의고사 외 문제집 풀이 결과를 별도로 기록할 수 있습니다.
* 시스템 테마에 맞춘 다크/라이트 모드 전환을 지원합니다.

---

## 다운로드

**시스템 요구사항:** macOS 12.0 Monterey 이상

1. [Releases 페이지](https://github.com/leekangmmin/EJUScore/releases/latest)에서 `EJUScore.app.zip`을 다운로드합니다.
2. 압축 해제 후 `EJUScore.app`을 **응용 프로그램** 폴더로 이동합니다.
3. 처음 실행 시 **우클릭 → 열기**를 선택해 Gatekeeper를 우회합니다.

---

## 개발

**요구사항:** Xcode 15+ · Node.js 20+

```bash
git clone https://github.com/leekangmmin/EJUScore.git
cd EJUScore

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

`main` 브랜치에 push하면 GitHub Actions가 React + macOS 앱을 자동으로 빌드하고 아티팩트를 저장합니다.

버전 태그를 push하면 GitHub Release가 자동으로 생성됩니다.

```bash
git tag v1.2.1
git push origin v1.2.1
```

---

## 프로젝트 구조

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

## 라이선스

MIT License. Copyright (c) 2025 이강민 (Lee Kangmin) — [github.com/leekangmmin](https://github.com/leekangmmin)
