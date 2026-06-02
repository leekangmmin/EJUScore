// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// AI Engine Unit Tests
// (Note: isElectronAI depends on window.electronAPI which is set at import time.
//  In jsdom tests, it will always be false unless we dynamically set it before import.)
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  isElectronAI,
  loadModel,
  generateFeedback,
} from '../utils/aiEngine';

describe('aiEngine.js', () => {
  describe('isElectronAI', () => {
    it('returns false in non-electron jsdom environment', () => {
      // window.electronAPI is not available in jsdom tests
      expect(isElectronAI()).toBe(false);
    });
  });

  describe('loadModel', () => {
    it('throws error when electron API not available', async () => {
      await expect(loadModel()).rejects.toThrow('Electron AI API not available');
    });

    it('throws error with onProgress callback', async () => {
      await expect(loadModel(() => {})).rejects.toThrow('Electron AI API not available');
    });
  });

  describe('generateFeedback', () => {
    it('throws error when electron API not available', async () => {
      await expect(generateFeedback([], {})).rejects.toThrow('Electron AI API not available');
    });

    it('throws error with null params', async () => {
      await expect(generateFeedback(null, null)).rejects.toThrow('Electron AI API not available');
    });

    it('throws error with undefined params', async () => {
      await expect(generateFeedback()).rejects.toThrow('Electron AI API not available');
    });

    it('throws error with onToken callback', async () => {
      await expect(generateFeedback([], {}, () => {})).rejects.toThrow('Electron AI API not available');
    });
  });
});
