// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Polyfills Unit Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';

// Import polyfills — they only install if methods are missing (defensive)
import '../utils/polyfills';

describe('polyfills.js', () => {
  describe('Uint8Array.prototype.toHex', () => {
    it('converts empty array to empty string', () => {
      const arr = new Uint8Array([]);
      expect(arr.toHex()).toBe('');
    });

    it('converts single byte to hex', () => {
      const arr = new Uint8Array([255]);
      expect(arr.toHex()).toBe('ff');
    });

    it('converts multiple bytes to hex', () => {
      const arr = new Uint8Array([0, 16, 32, 255]);
      expect(arr.toHex()).toBe('001020ff');
    });

    it('converts standard text bytes', () => {
      const arr = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      expect(arr.toHex()).toBe('48656c6c6f');
    });
  });

  describe('Uint8Array.prototype.setFromHex', () => {
    it('decodes hex string into buffer', () => {
      const arr = new Uint8Array(3);
      const result = arr.setFromHex('aabbcc');
      expect(result.read).toBe(6);
      expect(result.written).toBe(3);
      expect(arr[0]).toBe(0xaa);
      expect(arr[1]).toBe(0xbb);
      expect(arr[2]).toBe(0xcc);
    });

    it('handles even-length hex correctly', () => {
      const arr = new Uint8Array(2);
      const result = arr.setFromHex('abcd');
      expect(result.read).toBe(4);
      expect(result.written).toBe(2);
      expect(arr[0]).toBe(0xab);
      expect(arr[1]).toBe(0xcd);
    });
  });

  describe('Uint8Array.prototype.toBase64', () => {
    it('converts empty array to empty base64', () => {
      const arr = new Uint8Array([]);
      expect(arr.toBase64()).toBe('');
    });

    it('converts bytes to base64', () => {
      const arr = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      expect(arr.toBase64()).toBe('SGVsbG8=');
    });
  });

  describe('Uint8Array.prototype.setFromBase64', () => {
    it('decodes base64 string into buffer', () => {
      const arr = new Uint8Array(5);
      const result = arr.setFromBase64('SGVsbG8=');
      expect(result.written).toBe(5);
      expect(arr[0]).toBe(72);
      expect(arr[1]).toBe(101);
    });
  });

  describe('Map.prototype.getOrInsert', () => {
    it('returns existing value if key exists', () => {
      const map = new Map();
      map.set('key1', 'value1');
      const result = map.getOrInsert('key1', 'default');
      expect(result).toBe('value1');
      expect(map.size).toBe(1);
    });

    it('inserts and returns default value for missing key', () => {
      const map = new Map();
      const result = map.getOrInsert('newKey', 'defaultVal');
      expect(result).toBe('defaultVal');
      expect(map.get('newKey')).toBe('defaultVal');
    });

    it('works with numeric keys', () => {
      const map = new Map();
      const result = map.getOrInsert(42, { data: 'test' });
      expect(result.data).toBe('test');
    });
  });

  describe('Map.prototype.getOrInsertComputed', () => {
    it('returns existing value if key exists', () => {
      const map = new Map();
      map.set('existing', 100);
      const result = map.getOrInsertComputed('existing', () => 999);
      expect(result).toBe(100);
    });

    it('computes and inserts value for missing key', () => {
      const map = new Map();
      const result = map.getOrInsertComputed('computeKey', (key) => key.length * 2);
      expect(result).toBe(20); // 'computeKey'.length = 10, * 2 = 20
      expect(map.get('computeKey')).toBe(20);
    });
  });

  describe('Uint8Array.fromHex static method', () => {
    it('creates Uint8Array from hex string', () => {
      const arr = Uint8Array.fromHex('deadbeef');
      expect(arr.length).toBe(4);
      expect(arr[0]).toBe(0xde);
      expect(arr[1]).toBe(0xad);
      expect(arr[2]).toBe(0xbe);
      expect(arr[3]).toBe(0xef);
    });
  });

  describe('Uint8Array.fromBase64 static method', () => {
    it('creates Uint8Array from base64 string', () => {
      const arr = Uint8Array.fromBase64('SGVsbG8=');
      expect(arr.length).toBe(5);
      expect(arr[0]).toBe(72);
    });
  });
});
