// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Storage Interface — Comprehensive coverage
// Targets: JSON helpers, generic API delegation, setStorageProvider edge cases
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import {
  localStorageAdapter,
  setStorageProvider,
  getStorageProvider,
  getItem,
  setItem,
  removeItem,
  clear,
  getJSON,
  setJSON,
} from '../interfaces/storage';

describe('interfaces/storage.js — comprehensive', () => {
  beforeEach(() => {
    setStorageProvider(localStorageAdapter);
    localStorage.clear();
  });

  describe('Generic API delegation', () => {
    it('setJSON stores complex objects', async () => {
      const data = {
        name: '테스트',
        scores: [100, 200, 300],
        nested: { a: 1, b: { c: 2 } },
      };
      await setJSON('complex', data);
      const retrieved = await getJSON('complex');
      expect(retrieved).toEqual(data);
    });

    it('getJSON with empty string returns fallback', async () => {
      await setItem('empty-str', '');
      const result = await getJSON('empty-str', 'fallback');
      expect(result).toBe('fallback');
    });

    it('getJSON returns null for missing key', async () => {
      const result = await getJSON('nonexistent-key');
      expect(result).toBeNull();
    });

    it('getItem/setItem/removeItem/clear round-trip', async () => {
      await setItem('k1', 'v1');
      expect(await getItem('k1')).toBe('v1');
      await removeItem('k1');
      expect(await getItem('k1')).toBeNull();
    });
  });

  describe('localStorageAdapter direct usage', () => {
    it('handles getAllKeys with items', async () => {
      await localStorageAdapter.setItem('alpha', '1');
      await localStorageAdapter.setItem('beta', '2');
      const keys = await localStorageAdapter.getAllKeys();
      expect(keys).toContain('alpha');
      expect(keys).toContain('beta');
      expect(keys.length).toBe(2);
    });

    it('handles removeItem of missing key gracefully', async () => {
      await expect(localStorageAdapter.removeItem('missing')).resolves.toBeUndefined();
    });

    it('handles clear of empty storage gracefully', async () => {
      await expect(localStorageAdapter.clear()).resolves.toBeUndefined();
    });
  });

  describe('Error handling with restore', () => {
    it('restores original methods after error test', async () => {
      const orig = globalThis.localStorage.getItem;
      globalThis.localStorage.getItem = () => { throw new Error('test'); };
      expect(await localStorageAdapter.getItem('x')).toBeNull();
      globalThis.localStorage.getItem = orig;
      await localStorageAdapter.setItem('restored', 'yes');
      expect(await localStorageAdapter.getItem('restored')).toBe('yes');
    });
  });
});
