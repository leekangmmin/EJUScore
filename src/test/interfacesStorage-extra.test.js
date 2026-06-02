// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Storage Interface — Extended Coverage
// Targets: migrateToIndexedDB, localStorageAdapter edge cases, 
//          IndexedDB adapter structure
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  localStorageAdapter,
  indexedDBAdapter,
  setStorageProvider,
  getStorageProvider,
  migrateToIndexedDB,
} from '../interfaces/storage';

describe('interfaces/storage.js — extended', () => {
  beforeEach(() => {
    setStorageProvider(localStorageAdapter);
    localStorage.clear();
  });

  describe('localStorageAdapter edge cases', () => {
    it('getItem handles error gracefully', async () => {
      const origGetItem = globalThis.localStorage.getItem;
      globalThis.localStorage.getItem = vi.fn(() => { throw new Error('fail'); });
      const val = await localStorageAdapter.getItem('x');
      expect(val).toBeNull();
      globalThis.localStorage.getItem = origGetItem;
    });

    it('setItem handles quota error', async () => {
      const origSetItem = globalThis.localStorage.setItem;
      globalThis.localStorage.setItem = vi.fn(() => {
        const e = new DOMException('quota', 'QuotaExceededError');
        throw e;
      });
      await expect(localStorageAdapter.setItem('x', 'y')).rejects.toThrow();
      globalThis.localStorage.setItem = origSetItem;
    });

    it('setItem handles generic error', async () => {
      const origSetItem = globalThis.localStorage.setItem;
      globalThis.localStorage.setItem = vi.fn(() => { throw new Error('generic'); });
      await expect(localStorageAdapter.setItem('x', 'y')).rejects.toThrow();
      globalThis.localStorage.setItem = origSetItem;
    });

    it('removeItem handles error gracefully', async () => {
      const origRemoveItem = globalThis.localStorage.removeItem;
      globalThis.localStorage.removeItem = vi.fn(() => { throw new Error('fail'); });
      await expect(localStorageAdapter.removeItem('x')).resolves.toBeUndefined();
      globalThis.localStorage.removeItem = origRemoveItem;
    });

    it('clear handles error gracefully', async () => {
      const origClear = globalThis.localStorage.clear;
      globalThis.localStorage.clear = vi.fn(() => { throw new Error('fail'); });
      await expect(localStorageAdapter.clear()).resolves.toBeUndefined();
      globalThis.localStorage.clear = origClear;
    });

    it('getAllKeys handles error gracefully', async () => {
      const origLength = Object.getOwnPropertyDescriptor(globalThis.localStorage, 'length');
      // Temporarily break the length getter
      Object.defineProperty(globalThis.localStorage, 'length', { get: () => { throw new Error('fail'); }, configurable: true });
      const keys = await localStorageAdapter.getAllKeys();
      expect(keys).toEqual([]);
      if (origLength) Object.defineProperty(globalThis.localStorage, 'length', origLength);
    });
  });

  describe('indexedDBAdapter structure', () => {
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
  });

  describe('migrateToIndexedDB', () => {
    it('exists and is a function', () => {
      expect(typeof migrateToIndexedDB).toBe('function');
    });

    it('returns 0 when localStorage is empty', async () => {
      // We need to mock indexedDB for this
      const count = await migrateToIndexedDB();
      expect(count).toBe(0);
    });
  });

  describe('setStorageProvider edge cases', () => {
    it('allows switching between providers', () => {
      const mock = {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
        clear: async () => {},
        getAllKeys: async () => [],
      };
      const orig = getStorageProvider();
      setStorageProvider(mock);
      expect(getStorageProvider()).toBe(mock);
      setStorageProvider(orig);
      expect(getStorageProvider()).toBe(orig);
    });
  });
});
