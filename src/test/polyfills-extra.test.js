// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Polyfills — Extended Coverage
// Targets: WeakMap polyfills, Uint8Array static methods with edge cases
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import '../utils/polyfills';

describe('polyfills.js — extended', () => {
  describe('WeakMap.prototype.getOrInsert', () => {
    it('returns existing value for existing key', () => {
      const wm = new WeakMap();
      const key = {};
      wm.set(key, 'value1');
      expect(wm.getOrInsert(key, 'default')).toBe('value1');
    });

    it('inserts and returns for missing key', () => {
      const wm = new WeakMap();
      const key = {};
      const result = wm.getOrInsert(key, 'inserted');
      expect(result).toBe('inserted');
      expect(wm.get(key)).toBe('inserted');
    });
  });

  describe('WeakMap.prototype.getOrInsertComputed', () => {
    it('returns existing value for existing key', () => {
      const wm = new WeakMap();
      const key = {};
      wm.set(key, 42);
      expect(wm.getOrInsertComputed(key, () => 100)).toBe(42);
    });

    it('computes and inserts for missing key', () => {
      const wm = new WeakMap();
      const key = {};
      const result = wm.getOrInsertComputed(key, (k) => Object.keys(k).length);
      expect(result).toBe(0);
      expect(wm.get(key)).toBe(0);
    });
  });

  describe('Uint8Array.fromHex edge cases', () => {
    it('creates array from hex string', () => {
      const arr = Uint8Array.fromHex('0102ff');
      expect(arr.length).toBe(3);
      expect(arr[0]).toBe(1);
      expect(arr[1]).toBe(2);
      expect(arr[2]).toBe(255);
    });

    it('handles empty string', () => {
      const arr = Uint8Array.fromHex('');
      expect(arr.length).toBe(0);
    });
  });

  describe('Uint8Array.fromBase64 edge cases', () => {
    it('creates array from base64', () => {
      const arr = Uint8Array.fromBase64('AAEC/w==');
      expect(arr.length).toBe(4);
      expect(arr[0]).toBe(0);
      expect(arr[1]).toBe(1);
      expect(arr[2]).toBe(2);
      expect(arr[3]).toBe(255);
    });

    it('handles empty string', () => {
      const arr = Uint8Array.fromBase64('');
      expect(arr.length).toBe(0);
    });
  });

  describe('Uint8Array.prototype.toHex edge cases', () => {
    it('handles zero byte', () => {
      const arr = new Uint8Array([0]);
      expect(arr.toHex()).toBe('00');
    });
  });

  describe('Uint8Array.prototype.toBase64 edge cases', () => {
    it('handles zero byte', () => {
      const arr = new Uint8Array([0]);
      expect(arr.toBase64()).toBe('AA==');
    });
  });

  describe('Map.prototype.getOrInsertComputed edge cases', () => {
    it('calls callback only when key is missing', () => {
      const map = new Map();
      map.set('exists', 'val');
      const spy = vi.fn(() => 'computed');
      const result = map.getOrInsertComputed('exists', spy);
      expect(result).toBe('val');
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
