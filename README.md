<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="">
    <img alt="EJU Score Tracker" src="" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://leekangmmin.github.io/EJUScore/"><strong>Try the App →</strong></a>
  <br>
  <sub>PWA · no install required · iOS/Android/Desktop</sub>
</p>

<p align="center">
  <a href="https://github.com/leekangmmin/EJUScore/actions/workflows/pwa-deploy.yml"><img src="https://github.com/leekangmmin/EJUScore/actions/workflows/pwa-deploy.yml/badge.svg" alt="PWA Deploy"></a>
  <a href="https://github.com/leekangmmin/EJUScore/actions/workflows/build.yml"><img src="https://github.com/leekangmmin/EJUScore/actions/workflows/build.yml/badge.svg" alt="Build"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/leekangmmin/EJUScore/releases"><img src="https://img.shields.io/github/v/release/leekangmmin/EJUScore" alt="Release"></a>
</p>

<br>

> **EJU(日本留学試験) 모의고사 점수 관리 + AI 분석 도구.**  
> 회차별 점수를 기록하고, 성장 추이를 시각화하며, 시험지 스캔 파일을 AI 파이프라인으로 분석합니다.

<br>

---

<br>

## 미리보기

<p align="center">
  <img src="" alt="App Preview" width="100%" />
</p>

> 스크린샷은 준비 중입니다. [릴리즈 페이지](https://github.com/leekangmmin/EJUScore/releases)에서 구버전 스크린샷을 확인할 수 있습니다.

<br>

---

<br>

## 기능

|  |  |
|---|---|
| **📊 점수 트래킹** | EJU 일본어·종합과목·수학 점수를 회차별로 저장. LineChart 추이, 3개월 예측, 회차 비교, 통계 대시보드 |
| **🔍 AI OCR 분석** | 시험지 스캔(.jpg/.png/.pdf) 업로드 → 4단계 async 파이프라인. 토큰 추출 → 코사인 유사도 매칭 → 신뢰도 앙상블 |
| **🧩 38문항 개별 분석** | 종합과목(지리·역사·정치·경제·사회) 38문항 각각 키워드 매칭. Anti-Hallucination: 수학 수식 완전 차단 |
| **🔄 자동 재검사** | 신뢰도 80% 미만 시 부스트 파라미터로 최대 2회 재분석. 85% 미만 시 사용자 확인 모달 |
| **🩺 오답 진단** | 4가지 오답 유형 분류 (개념 혼동·사료 해석 오류·그래프 오독·제도 이해 부족) + 처방전 |
| **📱 PWA 지원** | Service Worker 오프라인 캐싱, push 알림, display: standalone, iOS/Android/Desktop 설치 |
| **💻 Desktop App** | Electron + electron-builder macOS DMG 빌드 (Windows/Linux 대응 중) |
| **🔔 D-day 알림** | 시험일 등록 시 D-7/D-3/D-1/D-day 푸시 알림 |

<br>

---

<br>

## 시작하기

```bash
git clone https://github.com/leekangmmin/EJUScore.git
cd EJUScore
npm install
npm run dev        # localhost:5173
```

| 플랫폼 | 설치 |
|---|---|
| Web | [leekangmmin.github.io/EJUScore](https://leekangmmin.github.io/EJUScore/) |
| iOS | Safari → 공유 → 홈 화면에 추가 |
| Android | Chrome → 설치 |
| Desktop | `npm run electron:dev` |

<br>

---

<br>

## 아키텍처

```
src/
├── components/          # Dashboard, EJU20YearTrend, DiagnosticReport
├── utils/               # storage, diagnosis, prediction, analytics
└── main.jsx             # Entry + SW registration
public/
├── manifest.json        # PWA manifest
├── sw.js                # Service Worker (cache-first + network-first)
└── robots.txt, sitemap.xml, 404.html
electron/                # Main process + preload + AI worker
.github/workflows/       # CI: build, pwa-deploy, release
```

**4-Stage OCR Pipeline:**

```
Phase 1  토큰 추출      → 파일명 파싱 + OCR 콘텐츠 생성 + 과목 판별
Phase 2  Subject 격리    → 종합과목: LaTeX 완전 차단 / 수학: LaTeX 정규화
Phase 3  시러버스 매칭   → 코사인 유사도 계산 (종합: 38문항 개별 매칭)
Phase 4  신뢰도 앙상블   → P1×0.25 + P2×0.3 + P3×0.45 → <80% 자동 재검사
```

> `setTimeout` / `setInterval` 없이 async/await + 실제 코사인 유사도 기반.  
> 모든 로그는 연산 완료 시점에 Promise 기반으로 출력.

<br>

---

<br>

## 스택

```
React 19           → UI
Vite 8             → Build
Recharts           → Charts (LineChart, RadarChart, PieChart)
KaTeX              → LaTeX rendering
Lucide React       → Icons
Tailwind CSS       → Design system
Electron           → Desktop wrapper
electron-builder   → macOS/Windows/Linux packaging
GitHub Actions     → CI/CD + PWA deploy
```

<br>

---

<br>

## 로드맵

- [x] 점수 기록 + 대시보드 + 회차 비교
- [x] EJU 38문항 개별 분석 파이프라인
- [x] PWA + 오프라인 캐싱 + 푸시 알림
- [x] macOS DMG 빌드 + 서명
- [x] 모바일 반응형 UI
- [x] AI 오답 진단 리포트
- [ ] Windows/Linux Electron 빌드 자동화
- [ ] 실제 OCR 엔진 연동
- [ ] 사용자 계정 + 클라우드 동기화
- [ ] 일본어 UI 지원

<br>

---

<br>

## 라이선스

MIT — © 2025 **이강민 (Lee Kangmin)**

<p align="center">
  <a href="https://github.com/leekangmmin/EJUScore">GitHub</a>
  ·
  <a href="https://leekangmmin.github.io/EJUScore/">Web App</a>
  ·
  <a href="https://github.com/leekangmmin/EJUScore/releases">Releases</a>
</p>
