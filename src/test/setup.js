// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Vitest Setup — Global test configuration and mocks
// ═══════════════════════════════════════════════════════════════════
import '@testing-library/jest-dom';

// ── Mock localStorage (non-enumerable methods for Object.keys compat) ──
const localStorageMock = (() => {
  let store = {};
  const mock = {};
  Object.defineProperty(mock, 'getItem', {
    value: (key) => store[key] ?? null,
    writable: true, configurable: true,
  });
  Object.defineProperty(mock, 'setItem', {
    value: (key, value) => { store[key] = String(value); },
    writable: true, configurable: true,
  });
  Object.defineProperty(mock, 'removeItem', {
    value: (key) => { delete store[key]; },
    writable: true, configurable: true,
  });
  Object.defineProperty(mock, 'clear', {
    value: () => { store = {}; },
    writable: true, configurable: true,
  });
  Object.defineProperty(mock, 'length', {
    get: () => Object.keys(store).length,
    configurable: true,
  });
  Object.defineProperty(mock, 'key', {
    value: (index) => Object.keys(store)[index] ?? null,
    writable: true, configurable: true,
  });
  return mock;
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// ── Mock crypto.randomUUID ────────────────────────────
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = {
    ...globalThis.crypto,
    randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }),
  };
}

// ── Mock Notification API ─────────────────────────────
globalThis.Notification = {
  permission: 'default',
  requestPermission: async () => 'granted',
};

// ── Suppress console warnings in tests ────────────────
globalThis.console.warn = (...args) => {
  if (args[0]?.includes?.('[Storage]')) return; // Suppress known warnings
};

// ── Mock IndexedDB for testing ────────────────────────
// Simple in-memory mock that mimics the IndexedDB API
const idbData = {};
globalThis.indexedDB = {
  open: (dbName, version) => {
    const req = {
      result: null,
      error: null,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      readyState: 'pending',
    };
    setTimeout(() => {
      const store = {
        objectStoreNames: { contains: (name) => name === 'kv_store' },
        createObjectStore: (name) => {
          idbData._data = idbData._data || {};
          return {};
        },
        transaction: (storeName, mode) => ({
          objectStore: (name) => ({
            get: (key) => {
              const getReq = {
                result: (idbData._data || {})[key] ?? null,
                onsuccess: null, onerror: null, readyState: 'pending',
              };
              setTimeout(() => {
                getReq.readyState = 'done';
                if (getReq.onsuccess) getReq.onsuccess({ target: getReq });
              }, 0);
              return getReq;
            },
            put: (value, key) => {
              if (!idbData._data) idbData._data = {};
              idbData._data[key] = value;
              const putReq = { onsuccess: null, onerror: null, readyState: 'pending' };
              setTimeout(() => {
                putReq.readyState = 'done';
                if (putReq.onsuccess) putReq.onsuccess({ target: putReq });
              }, 0);
              return putReq;
            },
            delete: (key) => {
              if (idbData._data) delete idbData._data[key];
              const delReq = { onsuccess: null, onerror: null, readyState: 'pending' };
              setTimeout(() => {
                delReq.readyState = 'done';
                if (delReq.onsuccess) delReq.onsuccess({ target: delReq });
              }, 0);
              return delReq;
            },
            clear: () => {
              idbData._data = {};
              const clearReq = { onsuccess: null, onerror: null, readyState: 'pending' };
              setTimeout(() => {
                if (clearReq.onsuccess) clearReq.onsuccess();
              }, 0);
              return clearReq;
            },
            getAllKeys: () => {
              const keysReq = { result: Object.keys(idbData._data || {}), onsuccess: null, onerror: null, readyState: 'pending' };
              setTimeout(() => {
                if (keysReq.onsuccess) keysReq.onsuccess({ target: keysReq });
              }, 0);
              return keysReq;
            },
          }),
        }),
      };
      req.result = store;
      req.readyState = 'done';
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  },
};
