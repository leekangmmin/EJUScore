// Copyright (c) 2025 이강민 (Lee Kangmin) — EJU Score Tracker Service Worker (PWA v2)
const CACHE_NAME = 'eju-score-v3';
const STATIC_CACHE = 'eju-static-v3';

self.addEventListener('install', e => {
  self.skipWaiting();
  // 캐시는 activate에서 lazy-load 방식으로 처리
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== STATIC_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // ── 같은 origin의 JS/CSS/woff2 파일 → Cache-First ──
  if (url.origin === self.location.origin && /\.(js|css|woff2)$/i.test(url.pathname)) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // ── 그 외 모든 요청 → Network-First, fallback to cache ──
  e.respondWith(
    fetch(e.request).then(res => {
      // HTML/JSON/매니페스트는 조건부 캐싱
      if (res.ok && (url.pathname.endsWith('.html') || url.pathname.endsWith('manifest.json'))) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
  );
});

// ── Push Notification 처리 ──────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() || { title: 'EJU 스코어', body: '공부할 시간이에요! 💪' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icon-192.png',
      badge: './favicon.svg',
      tag: 'eju-reminder',
      renotify: true,
      data: { url: self.location.origin },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || self.location.origin + self.location.pathname.replace(/\/sw\.js$/, '/');
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      const existing = list.find(c => c.url.startsWith(targetUrl));
      if (existing) return existing.focus();
      return clients.openWindow(targetUrl);
    })
  );
});

// ── D-day 알림 스케줄 (메시지 수신) ────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_DDAY') {
    const { dday, examDate } = e.data;
    let body = '';
    if (dday === 7)  body = `EJU 시험이 7일 남았어요! 마지막 스퍼트 🔥`;
    if (dday === 3)  body = `EJU 시험 D-3! 컨디션 관리에 집중하세요 ⚡`;
    if (dday === 1)  body = `내일이 EJU 시험이에요! 오늘은 가볍게 복습만 🎌`;
    if (dday === 0)  body = `오늘 EJU 시험 날이에요! 파이팅!! 🎯`;
    if (body) {
      self.registration.showNotification('📅 EJU 시험 D-day 알림', {
        body,
        icon: './icon-192.png',
        tag: `dday-${dday}`,
      });
    }
  }
});
