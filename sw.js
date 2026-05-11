// Copyright (c) 2025 이강민 (Lee Kangmin) — EJU Score Tracker Service Worker
const CACHE_NAME = 'eju-score-v2';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )   
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
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
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      const existing = list.find(c => c.url === e.notification.data?.url);
      if (existing) return existing.focus();
      return clients.openWindow(e.notification.data?.url || '/');
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
