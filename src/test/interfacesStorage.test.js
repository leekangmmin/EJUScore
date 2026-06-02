// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Storage Interface (Adapter Pattern) Unit Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import {
  localStorageAdapter,
  getStorageProvider,
  setStorageProvider,
  getItem,
  setItem,
  removeItem,
  clear,
  getJSON,
  setJSON,
} from '../interfaces/storage';

describe('interfaces/storage.js', () => {
  beforeEach(() => {
    setStorageProvider(localStorageAdapter);
    localStorage.clear();
  });

  describe('localStorageAdapter', () => {
    it('getItem returns null for missing key', async () => {
      const val = await localStorageAdapter.getItem('nonexistent');
      expect(val).toBeNull();
    });

    it('setItem and getItem round-trip', async () => {
      await localStorageAdapter.setItem('test-key', 'test-value');
      const val = await localStorageAdapter.getItem('test-key');
      expect(val).toBe('test-value');
    });

    it('removeItem removes key', async () => {
      await localStorageAdapter.setItem('temp', 'value');
      await localStorageAdapter.removeItem('temp');
      const val = await localStorageAdapter.getItem('temp');
      expect(val).toBeNull();
    });

    it('clear removes all keys', async () => {
      await localStorageAdapter.setItem('a', '1');
      await localStorageAdapter.setItem('b', '2');
      await localStorageAdapter.clear();
      const keys = await localStorageAdapter.getAllKeys();
      expect(keys).toHaveLength(0);
    });

    it('getAllKeys returns all stored keys', async () => {
      await localStorageAdapter.setItem('x', '10');
      await localStorageAdapter.setItem('y', '20');
      const keys = await localStorageAdapter.getAllKeys();
      expect(keys).toContain('x');
      expect(keys).toContain('y');
    });

    it('getAllKeys returns empty array for empty storage', async () => {
      const keys = await localStorageAdapter.getAllKeys();
      expect(keys).toEqual([]);
    });
  });

  describe('setStorageProvider / getStorageProvider', () => {
    it('default provider is localStorageAdapter', () => {
      expect(getStorageProvider()).toBe(localStorageAdapter);
    });

    it('setStorageProvider changes the provider', () => {
      const mockProvider = {
        getItem: async () => 'mock',
        setItem: async () => {},
        removeItem: async () => {},
        clear: async () => {},
        getAllKeys: async () => [],
      };
      setStorageProvider(mockProvider);
      expect(getStorageProvider()).toBe(mockProvider);
    });
  });

  describe('getItem / setItem / removeItem / clear', () => {
    it('getItem delegates to provider', async () => {
      await setItem('greeting', 'hello');
      const val = await getItem('greeting');
      expect(val).toBe('hello');
    });

    it('removeItem delegates to provider', async () => {
      await setItem('temp', 'value');
      await removeItem('temp');
      expect(await getItem('temp')).toBeNull();
    });

    it('clear delegates to provider', async () => {
      await setItem('a', '1');
      await clear();
      expect(await getItem('a')).toBeNull();
    });
  });

  describe('getJSON / setJSON', () => {
    it('setJSON serializes and stores object', async () => {
      const obj = { name: 'test', value: 42 };
      await setJSON('obj-key', obj);
      const raw = localStorage.getItem('obj-key');
      expect(JSON.parse(raw)).toEqual(obj);
    });

    it('getJSON retrieves and parses object', async () => {
      await setJSON('retrieve-key', { a: 1, b: [2, 3] });
      const result = await getJSON('retrieve-key');
      expect(result).toEqual({ a: 1, b: [2, 3] });
    });

    it('getJSON returns fallback for missing key', async () => {
      const result = await getJSON('missing', 'default');
      expect(result).toBe('default');
    });

    it('getJSON returns null default for missing key', async () => {
      const result = await getJSON('missing');
      expect(result).toBeNull();
    });

    it('getJSON returns fallback for corrupt data', async () => {
      localStorage.setItem('corrupt', '{{broken');
      const result = await getJSON('corrupt', { safe: true });
      expect(result).toEqual({ safe: true });
    });
  });

  describe('Custom storage provider', () => {
    it('allows swapping to a mock provider', async () => {
      const mockStore = {};
      const mockProvider = {
        getItem: async (k) => mockStore[k] ?? null,
        setItem: async (k, v) => { mockStore[k] = v; },
        removeItem: async (k) => { delete mockStore[k]; },
        clear: async () => { Object.keys(mockStore).forEach(k => delete mockStore[k]); },
        getAllKeys: async () => Object.keys(mockStore),
      };

      setStorageProvider(mockProvider);
      await setItem('key1', 'value1');
      const val = await getItem('key1');
      expect(val).toBe('value1');

      const keys = await mockProvider.getAllKeys();
      expect(keys).toContain('key1');
    });
  });
});
