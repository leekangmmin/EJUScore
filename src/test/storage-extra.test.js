// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Storage Utils — Extended Coverage
// Targets: notifyNative, normalizeCompScore edge cases, constants
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getExams, saveExam, deleteExam, getSettings, saveSettings,
  DEFAULT_SETTINGS, normalizeJapaneseScore, normalizeCompScore,
  loadSampleData, JAP_MAX, JAP_READ_MAX, JAP_LISTEN_MAX, COMP_MAX,
  JAP_READ_QUESTIONS, JAP_LISTEN_QUESTIONS, COMP_RAW_MAX,
} from '../utils/storage';

describe('storage.js — extended', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('constants', () => {
    it('exports correct EJU constants', () => {
      expect(JAP_MAX).toBe(370);
      expect(JAP_READ_MAX).toBe(185);
      expect(JAP_LISTEN_MAX).toBe(185);
      expect(COMP_MAX).toBe(198);
      expect(JAP_READ_QUESTIONS).toBe(25);
      expect(JAP_LISTEN_QUESTIONS).toBe(40);
      expect(COMP_RAW_MAX).toBe(200);
    });
  });

  describe('normalizeCompScore edge cases', () => {
    it('converts raw score with default rawMeta max', () => {
      const comp = { score: 100, rawMeta: { isRaw: true } };
      const n = normalizeCompScore(comp);
      expect(n).toBe(99); // 100 * 198 / 200
    });

    it('handles zero rawMeta max gracefully', () => {
      const comp = { score: 100, rawMeta: { isRaw: true, max: 0 } };
      const n = normalizeCompScore(comp);
      // should not divide by zero; 100 * 198 / MAX_RAW
      expect(n).toBeLessThanOrEqual(198);
    });
  });

  describe('normalizeJapaneseScore edge cases', () => {
    it('handles undefined rawMeta', () => {
      const jap = { reading: 150, listening: 140, rawMeta: null };
      const n = normalizeJapaneseScore(jap);
      expect(n.reading).toBe(150);
    });
  });

  describe('getSettings edge cases', () => {
    it('handles corrupt localStorage', () => {
      localStorage.setItem('eju_settings', 'not-json');
      const settings = getSettings();
      expect(settings).toMatchObject(DEFAULT_SETTINGS);
    });

    it('overrides with stored values', () => {
      localStorage.setItem('eju_settings', JSON.stringify({ targetJapanese: 350 }));
      const settings = getSettings();
      expect(settings.targetJapanese).toBe(350);
    });
  });

  describe('saveSettings edge cases', () => {
    it('stores settings correctly', () => {
      const s = { targetJapanese: 330, theme: 'light' };
      saveSettings(s);
      const stored = JSON.parse(localStorage.getItem('eju_settings'));
      expect(stored).toMatchObject(s);
    });
  });

  describe('loadSampleData', () => {
    it('loads 4 sample exams', () => {
      loadSampleData();
      const exams = getExams();
      expect(exams).toHaveLength(4);
    });
  });

  describe('notifyNative', () => {
    it('handles window.webkit gracefully', () => {
      // This is an internal function, test indirectly via saveExam
      window.webkit = { messageHandlers: { scoreData: { postMessage: vi.fn() } } };
      saveExam({ id: 'test-1', date: '2025-06', examName: 'Test', japanese: { reading: 150, listening: 140 } });
      expect(window.webkit.messageHandlers.scoreData.postMessage).toHaveBeenCalled();
      delete window.webkit;
    });

    it('handles missing webkit gracefully', () => {
      saveExam({ id: 'test-2', date: '2025-07', examName: 'Test2' });
      // Should not throw
    });
  });
});
