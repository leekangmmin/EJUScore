// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import './utils/polyfills'   // ⚠️ 반드시 최상단 — pdfjs(Uint8Array.toHex) 호환
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Pretendard Variable Font — @font-face 선언은 index.css 상단에서 처리
import './index.css'
import App from './App.jsx'

console.info(
  '%c EJU Score Tracker %c © 2025 이강민 (Lee Kangmin) %c github.com/leekangmmin/EJUScore ',
  'background:#4f8ef7;color:#fff;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px',
  'background:#1e1e2e;color:#a6e3a1;font-weight:600;padding:2px 6px',
  'background:#313244;color:#89b4fa;padding:2px 6px;border-radius:0 4px 4px 0'
)

// ── 일회성 정리: 기존 업로드 기출/오답 데이터 초기화 ──
// (모의고사 점수 eju_exam_data·설정은 보존, 업로드 변환문제만 삭제)
try {
  if (!localStorage.getItem('eju_clear_uploads_v1')) {
    localStorage.removeItem('eju_photo_questions');
    localStorage.removeItem('eju_ocr_analysis');
    localStorage.setItem('eju_clear_uploads_v1', '1');
  }
} catch (_) {}

// ── Electron 데스크톱: 서비스 워커 절대 등록 금지 ──────────────
// SW 의 fetch 핸들러가 file:// 요청을 fetch(e.request) 로 가로채면 실패하여
// tesseract 워커·WASM·언어데이터(.gz) 로드가 전부 막혀 OCR 이 0%에서 멈춘다.
// (SW 는 웹/PWA 전용 기능 — 데스크톱에선 기존에 설치된 것도 제거)
const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI;

if (IS_ELECTRON && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => Promise.all(regs.map(r => r.unregister())))
    .catch(() => {});
}

// ── PWA Service Worker + D-day 알림 (웹/PWA 전용) ──────────────
if (!IS_ELECTRON && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js');

      // 알림 권한 요청 (사용자 첫 방문 또는 권한 미결정 시)
      if ('Notification' in window && Notification.permission === 'default') {
        // 페이지 로드 후 3초 뒤에 조용히 요청
        setTimeout(async () => {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            // D-day 알림 스케줄 확인
            scheduleDdayNotification();
          }
        }, 3000);
      } else if (Notification.permission === 'granted') {
        scheduleDdayNotification();
      }
    } catch (_) {}
  });
}

function scheduleDdayNotification() {
  try {
    const settings = JSON.parse(localStorage.getItem('eju_settings') || '{}');
    if (!settings.nextExamDate) return;
    const dday = Math.ceil((new Date(settings.nextExamDate) - new Date()) / 86400000);
    if ([0, 1, 3, 7].includes(dday)) {
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({ type: 'SCHEDULE_DDAY', dday, examDate: settings.nextExamDate });
      });
    }
  } catch (_) {}
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
