// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Polyfills — Complete coverage for all polyfill methods
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

describe('polyfills.js — complete coverage', () => {
  // Save originals
  const origToHex = Uint8Array.prototype.toHex;
  const origSetFromHex = Uint8Array.prototype.setFromHex;
  const origToBase64 = Uint8Array.prototype.toBase64;
  const origSetFromBase64 = Uint8Array.prototype.setFromBase64;
  const origMapGetOrInsert = Map.prototype.getOrInsert;
  const origMapGetOrInsertComputed = Map.prototype.getOrInsertComputed;
  const origFromHex = Uint8Array.fromHex;
  const origFromBase64 = Uint8Array.fromBase64;

  beforeAll(async () => {
    // Delete all polyfill methods to force re-application
    delete Uint8Array.prototype.toHex;
    delete Uint8Array.prototype.setFromHex;
    delete Uint8Array.prototype.toBase64;
    delete Uint8Array.prototype.setFromBase64;
    delete Map.prototype.getOrInsert;
    delete Map.prototype.getOrInsertComputed;
    delete WeakMap.prototype.getOrInsert;
    delete WeakMap.prototype.getOrInsertComputed;
    delete Uint8Array.fromHex;
    delete Uint8Array.fromBase64;

    // Re-import to trigger polyfill installation
    await import('../utils/polyfills');
  });

  afterAll(() => {
    // Restore originals if they existed
    if (origToHex) Uint8Array.prototype.toHex = origToHex;
    if (origSetFromHex) Uint8Array.prototype.setFromHex = origSetFromHex;
    if (origToBase64) Uint8Array.prototype.toBase64 = origToBase64;
    if (origSetFromBase64) Uint8Array.prototype.setFromBase64 = origSetFromBase64;
    if (origMapGetOrInsert) Map.prototype.getOrInsert = origMapGetOrInsert;
    if (origMapGetOrInsertComputed) Map.prototype.getOrInsertComputed = origMapGetOrInsertComputed;
    if (origFromHex) Uint8Array.fromHex = origFromHex;
    if (origFromBase64) Uint8Array.fromBase64 = origFromBase64;
  });

  describe('Uint8Array.prototype', () => {
    it('toHex converts bytes to hex string', () => {
      const arr = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      expect(arr.toHex()).toBe('48656c6c6f');
    });

    it('toHex handles empty array', () => {
      const arr = new Uint8Array([]);
      expect(arr.toHex()).toBe('');
    });

    it('setFromHex fills array from hex string', () => {
      const arr = new Uint8Array(5);
      const result = arr.setFromHex('48656c6c6f');
      expect(result.read).toBe(10);
      expect(result.written).toBe(5);
      expect(arr[0]).toBe(0x48);
      expect(arr[4]).toBe(0x6f);
    });

    it('toBase64 converts bytes to base64 string', () => {
      const arr = new Uint8Array([72, 101, 108, 108, 111]);
      expect(arr.toBase64()).toBe('SGVsbG8=');
    });

    it('toBase64 handles empty array', () => {
      const arr = new Uint8Array([]);
      expect(arr.toBase64()).toBe('');
    });

    it('setFromBase64 fills array from base64 string', () => {
      const arr = new Uint8Array(5);
      const result = arr.setFromBase64('SGVsbG8=');
      expect(result.read).toBe(5);
      expect(result.written).toBe(5);
      expect(arr[0]).toBe(72);
      expect(arr[4]).toBe(111);
    });
  });

  describe('Map/WeakMap polyfills', () => {
    it('getOrInsert returns existing value', () => {
      const map = new Map([['a', 1]]);
      expect(map.getOrInsert('a', 99)).toBe(1);
    });

    it('getOrInsert inserts and returns new value', () => {
      const map = new Map();
      expect(map.getOrInsert('b', 42)).toBe(42);
      expect(map.get('b')).toBe(42);
    });

    it('getOrInsertComputed returns existing value', () => {
      const map = new Map([['x', 10]]);
      const fn = vi.fn(() => 20);
      expect(map.getOrInsertComputed('x', fn)).toBe(10);
      expect(fn).not.toHaveBeenCalled();
    });

    it('getOrInsertComputed computes and inserts new value', () => {
      const map = new Map();
      const fn = vi.fn(() => 99);
      expect(map.getOrInsertComputed('key', fn)).toBe(99);
      expect(fn).toHaveBeenCalledWith('key');
      expect(map.get('key')).toBe(99);
    });

    it('WeakMap getOrInsert works', () => {
      const wm = new WeakMap();
      const obj = {};
      expect(wm.getOrInsert(obj, 42)).toBe(42);
      expect(wm.get(obj)).toBe(42);
    });

    it('WeakMap getOrInsertComputed works', () => {
      const wm = new WeakMap();
      const obj = {};
      const fn = vi.fn(() => 77);
      expect(wm.getOrInsertComputed(obj, fn)).toBe(77);
      expect(fn).toHaveBeenCalledWith(obj);
    });
  });

  describe('Uint8Array static methods', () => {
    it('fromHex creates array from hex string', () => {
      const arr = Uint8Array.fromHex('0102030a0b0c');
      expect(arr.length).toBe(6);
      expect(arr[0]).toBe(1);
      expect(arr[5]).toBe(12);
    });

    it('fromHex handles empty string', () => {
      const arr = Uint8Array.fromHex('');
      expect(arr.length).toBe(0);
    });

    it('fromBase64 creates array from base64 string', () => {
      const arr = Uint8Array.fromBase64('SGVsbG8=');
      expect(arr.length).toBe(5);
      expect(arr[0]).toBe(72);
      expect(arr[4]).toBe(111);
    });

    it('fromBase64 handles empty string', () => {
      const arr = Uint8Array.fromBase64('');
      expect(arr.length).toBe(0);
    });
  });

  describe('Duplicate call safety', () => {
    it('can be called multiple times without error', async () => {
      // Re-importing should not throw even though methods already exist
      await expect(import('../utils/polyfills')).resolves.toBeDefined();
    });
  });
});
