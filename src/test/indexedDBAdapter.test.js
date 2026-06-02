// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// IndexedDB Adapter — Integration Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import {
  indexedDBAdapter,
  localStorageAdapter,
  setStorageProvider,
  getStorageProvider,
  migrateToIndexedDB,
  getItem,
  setItem,
  removeItem,
  clear,
  getJSON,
  setJSON,
} from '../interfaces/storage';

describe('indexedDBAdapter', () => {
  beforeEach(async () => {
    setStorageProvider(localStorageAdapter);
    localStorage.clear();
    // Clear IDB mock data
    if (globalThis.indexedDB) {
      // Reset by clearing
      try {
        const db = await indexedDBAdapter._getDB();
        if (db) {
          const tx = db.transaction('kv_store', 'readwrite');
          const store = tx.objectStore('kv_store');
          store.clear();
        }
      } catch {}
    }
  });

  it('has correct DB metadata', () => {
    expect(indexedDBAdapter.DB_NAME).toBe('eju_score_tracker');
    expect(indexedDBAdapter.STORE_NAME).toBe('kv_store');
    expect(indexedDBAdapter.DB_VERSION).toBe(1);
  });

  it('has all required methods', () => {
    expect(typeof indexedDBAdapter.getItem).toBe('function');
    expect(typeof indexedDBAdapter.setItem).toBe('function');
    expect(typeof indexedDBAdapter.removeItem).toBe('function');
    expect(typeof indexedDBAdapter.clear).toBe('function');
    expect(typeof indexedDBAdapter.getAllKeys).toBe('function');
    expect(typeof indexedDBAdapter._getDB).toBe('function');
  });

  it('can set and get items', async () => {
    setStorageProvider(indexedDBAdapter);
    await setItem('test-key', 'test-value');
    const val = await getItem('test-key');
    expect(val).toBe('test-value');
  });

  it('returns null for missing key', async () => {
    setStorageProvider(indexedDBAdapter);
    const val = await getItem('nonexistent');
    expect(val).toBeNull();
  });

  it('can remove items', async () => {
    setStorageProvider(indexedDBAdapter);
    await setItem('temp', 'value');
    await removeItem('temp');
    expect(await getItem('temp')).toBeNull();
  });

  it('can clear all items', async () => {
    setStorageProvider(indexedDBAdapter);
    await setItem('a', '1');
    await setItem('b', '2');
    await clear();
    expect(await getItem('a')).toBeNull();
    expect(await getItem('b')).toBeNull();
  });

  it('getAllKeys returns stored keys', async () => {
    setStorageProvider(indexedDBAdapter);
    await setItem('x', '10');
    await setItem('y', '20');
    const keys = await indexedDBAdapter.getAllKeys();
    expect(keys).toContain('x');
    expect(keys).toContain('y');
  });

  it('getAllKeys returns empty array for empty storage', async () => {
    setStorageProvider(indexedDBAdapter);
    const keys = await indexedDBAdapter.getAllKeys();
    expect(keys).toEqual([]);
  });

  it('handles JSON round-trip', async () => {
    setStorageProvider(indexedDBAdapter);
    const data = { a: 1, b: [2, 3], c: { d: 4 } };
    await setJSON('json-key', data);
    const retrieved = await getJSON('json-key');
    expect(retrieved).toEqual(data);
  });
});

describe('migrateToIndexedDB', () => {
  beforeEach(() => {
    setStorageProvider(localStorageAdapter);
    localStorage.clear();
  });

  it('migrates all keys from localStorage to indexedDB', async () => {
    localStorage.setItem('key1', 'value1');
    localStorage.setItem('key2', 'value2');
    const count = await migrateToIndexedDB();
    expect(count).toBe(2);

    // Verify data in IDB
    const val1 = await indexedDBAdapter.getItem('key1');
    const val2 = await indexedDBAdapter.getItem('key2');
    expect(val1).toBe('value1');
    expect(val2).toBe('value2');
  });

  it('returns 0 when localStorage is empty', async () => {
    const count = await migrateToIndexedDB();
    expect(count).toBe(0);
  });

  it('switches provider to indexedDB after migration', async () => {
    localStorage.setItem('test', 'data');
    await migrateToIndexedDB();
    const provider = getStorageProvider();
    expect(provider).not.toBe(localStorageAdapter);
    expect(provider).toBe(indexedDBAdapter);
  });
});
