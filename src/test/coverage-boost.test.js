// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Coverage boost — remaining uncovered lines in utils
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { getDday } from '../utils/diagnosis';
import { generateQuickInsight, detectBurnoutRisk } from '../utils/analytics';
import { generateDailyTasks, getCompletionStats } from '../utils/taskEngine';

describe('coverage-boost', () => {
  describe('diagnosis edge', () => {
    it('getDday returns 0 for today', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(getDday(today)).toBe(0);
    });
  });

  describe('analytics generateQuickInsight near target', () => {
    it('generates near-target insight when close', () => {
      const exams = [{ date: '2025-01', japanese: { reading: 155, listening: 155 } }];
      const result = generateQuickInsight(exams, { targetJapanese: 320 });
      expect(result).not.toBeNull();
    });
  });

  describe('getCompletionStats with data', () => {
    it('handles empty records', () => {
      const stats = getCompletionStats(7);
      expect(Array.isArray(stats)).toBe(true);
    });
  });

  describe('generateDailyTasks with repeated wrong questions', () => {
    it('generates tasks for listening mistakes in 31-40 range', () => {
      const exams = [
        { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [], listening: [35, 36, 37] } }, comprehensive: { score: 70, mistakes: [] } },
        { date: '2025-02', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [], listening: [35, 38] } }, comprehensive: { score: 70, mistakes: [] } },
      ];
      const tasks = generateDailyTasks(exams);
      expect(tasks.length).toBeGreaterThan(0);
    });
  });

  describe('detectBurnoutRisk gap > 2 months', () => {
    it('detects long gap between exams', () => {
      const exams = [
        { date: '2025-01', japanese: { reading: 100, listening: 100 } },
        { date: '2025-06', japanese: { reading: 100, listening: 100 } },
      ];
      const result = detectBurnoutRisk(exams);
      expect(result.reasons.some(r => r.includes('간격') || r.includes('2개월'))).toBe(true);
    });
  });
});
