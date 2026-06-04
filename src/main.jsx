// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
import './utils/polyfills'   // ⚠️ 반드시 최상단 — pdfjs(Uint8Array.toHex) 호환
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Pretendard Variable Font — @font-face 선언은 index.css 상단에서 처리
import './index.css'
import App from './App.jsx'

// ── Engine Initialization (auto-executes on boot) ─────────────────────
import { initializeEngine } from './intelligence/engineInitializer';
// Start loading datasets immediately — non-blocking
const engineInitPromise = initializeEngine();

console.info(
  '%c EJU Score Tracker %c © 2025 이강민 (Lee Kangmin) %c github.com/leekangmmin/EJUScore ',
  'background:#4f8ef7;color:#fff;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px',
  'background:#1e1e2e;color:#a6e3a1;font-weight:600;padding:2px 6px',
  'background:#313244;color:#89b4fa;padding:2px 6px;border-radius:0 4px 4px 0'
)

// ── Electron 데스크톱: 서비스 워커 절대 등록 금지 ──────────────
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

      if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(async () => {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') scheduleDdayNotification();
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

// ── Render App after datasets are loaded ──────────────────────────────
// We wait for datasets so ExamIntelligenceCenter has data immediately.
// If datasets fail to load, the app still renders (graceful degradation).
engineInitPromise.then(() => {
  console.info('[EJUScore] Engine ready — rendering app');
}).catch(err => {
  console.warn('[EJUScore] Engine init error (non-fatal):', err.message);
}).finally(() => {
  renderApp();
});

// ── Admin route detection (additive — existing app untouched) ─────────
// The admin console is a self-contained SPA mounted at #/admin/*.
// Entering it requires a page load at a #/admin URL, so the main app's
// state-based navigation and styling are never affected.
function isAdminRoute() {
  try {
    return (window.location.hash || '').replace(/^#/, '').startsWith('/admin');
  } catch {
    return false;
  }
}

function renderApp() {
  const container = document.getElementById('root');
  if (!container) return; // no mount point (e.g., test env) → skip render
  const root = createRoot(container);
  if (isAdminRoute()) {
    import('./admin/AdminApp.jsx').then(({ default: AdminApp }) => {
      root.render(<StrictMode><AdminApp /></StrictMode>);
    });
    return;
  }
  // ── First-visit: show the marketing landing page once ──────────────
  // Standalone PWA (installed app) skips the landing.
  try {
    const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches
      || window.navigator?.standalone;
    if (import.meta.env.PROD && !isStandalone && !localStorage.getItem('eju_landing_seen') && !location.hash) {
      localStorage.setItem('eju_landing_seen', '1');
      location.replace((import.meta.env.BASE_URL || '/') + 'landing.html');
      return;
    }
  } catch { /* ignore — fall through to app */ }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
