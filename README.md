# EJU Score Tracker

EJU(日本留学試験) 모의고사 점수 관리 + AI 분석 도구입니다.  
PWA로 만들어서 별도 설치 없이 브라우저에서 바로 쓸 수 있고, Electron 빌드로 데스크톱 앱도 쓸 수 있습니다.

**→ [https://leekangmmin.github.io/EJUScore/](https://leekangmmin.github.io/EJUScore/)**

---

### 이게 뭐 하는 건가

일본 유학 시험(EJU) 준비하면서 점수를 회차별로 저장하고, 추이를 그래프로 보고, 오답 패턴을 분석하고 싶을 때 쓰는 도구입니다.

- 시험 점수 기록하면 LineChart로 자동 트래킹
- 회차별 비교, 평균/최고점/표준편차 통계, 3개월 예측선
- 종합과목 38문항에 대해 오답 유형을 4가지로 분류 (개념 혼동, 사료 해석 실수, 그래프 오독, 제도 이해 부족)
- 시험지 스캔 파일(.jpg/.png/.pdf) 올리면 4단계 파이프라인으로 분석 (토큰 추출 → 시러버스 매칭 → 신뢰도 앙상블)
- 종합과목 파일은 38문항 각각을 개별 분석. 수학 파일은 LaTeX 수식 복원.
- 신뢰도가 기준 이하면 자동 재검사 or 사용자 확인 모달
- D-day 등록하면 푸시 알림 (PWA 설치 시)
- 설치 없이 웹에서 바로 사용 가능, 오프라인 캐싱 지원

---

### 언제 쓰나

- 매주 모의고사 보고 점수를 기록하면서 성적 추이를 보고 싶을 때
- "이번에는 경제 파트에서만 유독 틀렸는데" 싶을 때 오답 진단 돌려보고
- 기출 스캔 파일 올려서 "이 시험지가 어느 연도, 어느 파트 중심인지" AI가 분류해주는 걸 보고 싶을 때

---

### 설치/실행

```bash
git clone https://github.com/leekangmmin/EJUScore.git
cd EJUScore
npm install
npm run dev        # 웹 브라우저에서 개발
npm run build      # 프로덕션 빌드
npm run electron:dev  # 데스크톱 앱 실행
```

웹으로 바로 쓸 수도 있습니다 — [https://leekangmmin.github.io/EJUScore/](https://leekangmmin.github.io/EJUScore/)

| 플랫폼 | 설치 방법 |
|--------|----------|
| iOS | Safari → 공유 → 홈 화면에 추가 |
| Android | Chrome → 설치 |
| 데스크톱 | Chrome/Edge → 설치 버튼, 또는 Electron DMG |

---

### 구조

```
src/
├── components/     # Dashboard, EJU20YearTrend, DiagnosticReport 등
├── utils/          # storage, diagnosis, analytics, taskEngine
└── main.jsx        # 진입점 + SW 등록
public/
├── manifest.json   # PWA 매니페스트
├── sw.js           # Service Worker
└── robots.txt, sitemap.xml, 404.html
.github/workflows/  # CI: build, deploy, release
electron/           # Electron 메인 프로세스
index.html          # SEO 메타 태그
```

파이프라인은 4단계 async로 돌아갑니다:

1. 파일명에서 토큰 추출 → 과목 판별 (종합/수학/혼합)
2. 수학 파일은 LaTeX 수식 정규화, 종합 파일은 이 단계 자체를 스킵 (환각 방지)
3. 토큰과 시러버스 키워드 간 코사인 유사도 계산. 종합과목은 38개 문항 각각 매칭
4. 가중 평균(P1×0.25 + P2×0.3 + P3×0.45)으로 신뢰도 산출. 80% 미만이면 파라미터 부스트해서 최대 2회 재검사. 85% 미만이면 사용자 확인 요청

`setTimeout`/`setInterval` 없이, 실제 연산 결과가 나올 때만 로그가 출력됩니다.

---

### 스택

React 19, Vite 8, Tailwind CSS.  
차트는 Recharts, 아이콘은 Lucide, 수식 렌더링은 KaTeX.  
PWA는 Service Worker + Manifest. 데스크톱은 Electron + electron-builder.  
CI/CD는 GitHub Actions.

---

### 아직인 것

- [ ] Windows/Linux Electron 빌드 자동화
- [ ] 실제 OCR 엔진 연동 (지금은 파일명 기반 시뮬레이션)
- [ ] 사용자 계정 및 클라우드 동기화
- [ ] 일본어 UI
- [ ] 과목별 취약점 히트맵

### 알려진 제약

- OCR은 시뮬레이션입니다. 파일 내용을 실제로 읽는 게 아니라 파일명을 파싱해서 키워드를 추출합니다. 파일명을 EJU 형식에 맞게 지어야 분류 정확도가 올라갑니다.
- 한국어 전용 UI입니다.
- 모든 데이터는 브라우저 localStorage에 저장됩니다. 초기화하면 점수가 사라집니다.
- iOS 푸시 알림은 PWA를 홈 화면에 추가한 상태에서만 동작합니다.

---

라이선스: MIT. © 2025 이강민 (Lee Kangmin)

[GitHub](https://github.com/leekangmmin/EJUScore)
