// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Storage Interface — Edge case coverage
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  localStorageAdapter,
  setStorageProvider,
  getStorageProvider,
} from '../interfaces/storage';

describe('interfaces/storage.js — edge cases', () => {
  beforeEach(() => {
    setStorageProvider(localStorageAdapter);
    localStorage.clear();
  });

  describe('localStorageAdapter error handling', () => {
    it('getItem returns null on error', async () => {
      const orig = globalThis.localStorage.getItem;
      globalThis.localStorage.getItem = vi.fn(() => { throw new Error('fail'); });
      expect(await localStorageAdapter.getItem('x')).toBeNull();
      globalThis.localStorage.getItem = orig;
    });

    it('removeItem handles error gracefully', async () => {
      const orig = globalThis.localStorage.removeItem;
      globalThis.localStorage.removeItem = vi.fn(() => { throw new Error('fail'); });
      await expect(localStorageAdapter.removeItem('x')).resolves.toBeUndefined();
      globalThis.localStorage.removeItem = orig;
    });

    it('clear handles error gracefully', async () => {
      const orig = globalThis.localStorage.clear;
      globalThis.localStorage.clear = vi.fn(() => { throw new Error('fail'); });
      await expect(localStorageAdapter.clear()).resolves.toBeUndefined();
      globalThis.localStorage.clear = orig;
    });

    it('getAllKeys returns empty array on error', async () => {
      const orig = Object.getOwnPropertyDescriptor(globalThis.localStorage, 'length');
      Object.defineProperty(globalThis.localStorage, 'length', { get: () => { throw new Error('fail'); }, configurable: true });
      const keys = await localStorageAdapter.getAllKeys();
      expect(keys).toEqual([]);
      if (orig) Object.defineProperty(globalThis.localStorage, 'length', orig);
    });
  });
});
