// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
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

// ── PWA Service Worker + D-day 알림 ──────────────
if ('serviceWorker' in navigator) {
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
