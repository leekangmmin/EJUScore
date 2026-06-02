// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// AI Engine — Extended Coverage
// Targets: buildPrompt internal function, edge cases
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('aiEngine.js — extended', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('isElectronAI', () => {
    it('returns true when electronAPI exists', async () => {
      window.electronAPI = { ai: { load: vi.fn(), generate: vi.fn(), cleanup: vi.fn(), onProgress: vi.fn(), onToken: vi.fn() } };
      const { isElectronAI } = await import('../utils/aiEngine');
      expect(isElectronAI()).toBe(true);
      delete window.electronAPI;
    });

    it('returns false when electronAPI.ai missing', async () => {
      window.electronAPI = {};
      const { isElectronAI } = await import('../utils/aiEngine');
      expect(isElectronAI()).toBe(false);
      delete window.electronAPI;
    });
  });

  describe('loadModel with electron API', () => {
    it('calls onProgress when available', async () => {
      const onProgress = vi.fn();
      const loadMock = vi.fn().mockResolvedValue(undefined);
      window.electronAPI = { ai: { load: loadMock, cleanup: vi.fn(), onProgress: vi.fn(), onToken: vi.fn() } };
      const { loadModel } = await import('../utils/aiEngine');
      await loadModel(onProgress);
      expect(loadMock).toHaveBeenCalled();
      delete window.electronAPI;
    });
  });
});
