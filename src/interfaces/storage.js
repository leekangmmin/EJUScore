// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Storage Abstraction Layer — Adapter Pattern
// Supports: localStorage | IndexedDB | Cloud Sync (pluggable)
// Migration path:
//   localStorage (current) → IndexedDB (P0) → +Cloud Sync (P2)
// ═══════════════════════════════════════════════════════════════════

// ── Current Backend: localStorage Adapter ───────────────
export const localStorageAdapter = {
  getItem: async (key) => {
    try { return localStorage.getItem(key); }
    catch { return null; }
  },
  setItem: async (key, value) => {
    try { localStorage.setItem(key, value); }
    catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('[Storage] localStorage full, falling back');
        throw e;
      }
      throw e;
    }
  },
  removeItem: async (key) => {
    try { localStorage.removeItem(key); }
    catch {}
  },
  clear: async () => {
    try { localStorage.clear(); }
    catch {}
  },
  getAllKeys: async () => {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
      }
      return keys;
    } catch { return []; }
  },
};

// ── IndexedDB Adapter (for future use) ──────────────────
export const indexedDBAdapter = {
  DB_NAME: 'eju_score_tracker',
  DB_VERSION: 1,
  STORE_NAME: 'kv_store',

  async _getDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  getItem: async (key) => {
    const db = await indexedDBAdapter._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(indexedDBAdapter.STORE_NAME, 'readonly');
      const store = tx.objectStore(indexedDBAdapter.STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  },

  setItem: async (key, value) => {
    const db = await indexedDBAdapter._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(indexedDBAdapter.STORE_NAME, 'readwrite');
      const store = tx.objectStore(indexedDBAdapter.STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  removeItem: async (key) => {
    const db = await indexedDBAdapter._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(indexedDBAdapter.STORE_NAME, 'readwrite');
      const store = tx.objectStore(indexedDBAdapter.STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  clear: async () => {
    const db = await indexedDBAdapter._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(indexedDBAdapter.STORE_NAME, 'readwrite');
      const store = tx.objectStore(indexedDBAdapter.STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  getAllKeys: async () => {
    const db = await indexedDBAdapter._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(indexedDBAdapter.STORE_NAME, 'readonly');
      const store = tx.objectStore(indexedDBAdapter.STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result.map(k => String(k)));
      req.onerror = () => reject(req.error);
    });
  },
};

// ── Active Storage Provider ─────────────────────────────
let _provider = localStorageAdapter;

export function getStorageProvider() {
  return _provider;
}

export function setStorageProvider(provider) {
  _provider = provider;
}

// ── Generic Storage API ─────────────────────────────────
export async function getItem(key) {
  return _provider.getItem(key);
}

export async function setItem(key, value) {
  return _provider.setItem(key, value);
}

export async function removeItem(key) {
  return _provider.removeItem(key);
}

export async function clear() {
  return _provider.clear();
}

// ── JSON helpers ────────────────────────────────────────
export async function getJSON(key, fallback = null) {
  try {
    const raw = await getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function setJSON(key, value) {
  return setItem(key, JSON.stringify(value));
}

// ── Migration Helper ────────────────────────────────────
export async function migrateToIndexedDB() {
  const ls = localStorageAdapter;
  const idb = indexedDBAdapter;
  const keys = await ls.getAllKeys();
  for (const key of keys) {
    const val = await ls.getItem(key);
    if (val !== null) await idb.setItem(key, val);
  }
  setStorageProvider(idb);
  return keys.length;
}
