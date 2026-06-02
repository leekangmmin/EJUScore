// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Analytics Unit Tests — Extended coverage
// Targets: generateQuickInsight, edge cases in existing functions
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStudyStreak,
  getStudyConsistency,
  detectStagnation,
  detectBurnoutRisk,
  getAchievementProbability,
  generateQuickInsight,
} from '../utils/analytics';

function makeExam(date, jap, comp) {
  return {
    id: `e-${date}`,
    date,
    examName: `Exam ${date}`,
    ...(jap ? { japanese: { reading: jap.reading, listening: jap.listening } } : {}),
    ...(comp != null ? { comprehensive: { score: comp } } : {}),
  };
}

// Helper to generate date strings relative to current month
function relativeDate(monthsAgo) {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

describe('analytics.js — extended coverage', () => {
  describe('getStudyStreak edge cases', () => {
    it('handles single exam', () => {
      const exams = [makeExam('2025-06', { reading: 100, listening: 100 })];
      const s = getStudyStreak(exams);
      expect(s.current).toBe(1);
      expect(s.best).toBe(1);
      expect(s.lastActiveMonth).toBe('2025-06');
    });

    it('handles multi-year streak', () => {
      const exams = [
        makeExam('2024-11', { reading: 100, listening: 100 }),
        makeExam('2024-12', { reading: 110, listening: 100 }),
        makeExam('2025-01', { reading: 120, listening: 100 }),
      ];
      const s = getStudyStreak(exams);
      expect(s.current).toBe(3);
      expect(s.best).toBe(3);
    });

    it('resets streak on large gap', () => {
      const exams = [
        makeExam('2025-01', { reading: 100, listening: 100 }),
        makeExam('2025-03', { reading: 110, listening: 100 }),
        makeExam('2025-04', { reading: 120, listening: 100 }),
      ];
      const s = getStudyStreak(exams);
      // Jan → Mar is a 2-month gap, resets
      expect(s.current).toBe(2); // Mar→Apr (consecutive)
      expect(s.best).toBe(2);
    });
  });

  describe('getStudyConsistency edge cases', () => {
    it('returns 100 for full attendance', () => {
      // Use dates relative to current month to match lookback
      const exams = [
        makeExam(relativeDate(2), { reading: 100, listening: 100 }),
        makeExam(relativeDate(1), { reading: 110, listening: 100 }),
        makeExam(relativeDate(0), { reading: 120, listening: 100 }),
      ];
      const c = getStudyConsistency(exams, 3);
      expect(c).toBe(100);
    });

    it('returns partial consistency', () => {
      // 2 out of 3 recent months have exams
      const exams = [
        makeExam(relativeDate(2), { reading: 100, listening: 100 }),
        makeExam(relativeDate(0), { reading: 120, listening: 100 }),
      ];
      const c = getStudyConsistency(exams, 3);
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(100);
    });
  });

  describe('detectStagnation edge cases', () => {
    it('returns false for improving scores', () => {
      const exams = [
        makeExam('2025-01', { reading: 100, listening: 100 }),
        makeExam('2025-02', { reading: 120, listening: 100 }),
        makeExam('2025-03', { reading: 140, listening: 100 }),
        makeExam('2025-04', { reading: 160, listening: 100 }),
      ];
      const s = detectStagnation(exams, 8, 4);
      expect(s.japanese).toBe(false);
      expect(s.comprehensive).toBe(false);
    });

    it('returns combo for japanese+comprehensive', () => {
      const exams = [
        makeExam('2025-01', { reading: 100, listening: 100 }, 100),
        makeExam('2025-02', { reading: 102, listening: 100 }, 101),
        makeExam('2025-03', { reading: 101, listening: 102 }, 102),
        makeExam('2025-04', { reading: 103, listening: 100 }, 100),
      ];
      const s = detectStagnation(exams, 8, 4);
      expect(s.japanese).toBe(true);
      expect(s.comprehensive).toBeDefined();
    });
  });

  describe('detectBurnoutRisk edge cases', () => {
    it('detects medium risk', () => {
      const exams = [
        makeExam('2025-01', { reading: 150, listening: 140 }),
        makeExam('2025-04', { reading: 145, listening: 135 }),
      ];
      const r = detectBurnoutRisk(exams);
      expect(['medium', 'low']).toContain(r.risk);
    });

    it('returns reasons array', () => {
      const exams = [
        makeExam('2025-01', { reading: 160, listening: 140 }),
        makeExam('2025-02', { reading: 130, listening: 120 }),
        makeExam('2025-03', { reading: 110, listening: 100 }),
      ];
      const r = detectBurnoutRisk(exams);
      expect(Array.isArray(r.reasons)).toBe(true);
      expect(r.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('getAchievementProbability edge cases', () => {
    it('calculates probability for improving scores', () => {
      const exams = [
        makeExam('2025-01', { reading: 130, listening: 120 }),
        makeExam('2025-02', { reading: 140, listening: 130 }),
        makeExam('2025-03', { reading: 150, listening: 140 }),
      ];
      const p = getAchievementProbability(exams, 320, 170);
      expect(p.japanese).toBeGreaterThan(0);
      expect(p.japanese).toBeLessThanOrEqual(99);
    });

    it('handles comprehensive-only exams', () => {
      const exams = [
        makeExam('2025-01', null, 150),
        makeExam('2025-02', null, 160),
      ];
      const p = getAchievementProbability(exams, 320, 170);
      expect(p.japanese).toBeNull();
      expect(p.comprehensive).toBeGreaterThan(0);
    });
  });

  describe('generateQuickInsight', () => {
    it('returns null for empty exams', () => {
      expect(generateQuickInsight([], {})).toBeNull();
    });

    it('returns info insight for single exam', () => {
      const exams = [makeExam('2025-06', { reading: 100, listening: 100 })];
      const insight = generateQuickInsight(exams, { targetJapanese: 320, targetComprehensive: 170 });
      expect(insight).not.toBeNull();
      expect(['info', 'warning', 'success']).toContain(insight.type);
    });

    it('detects near-goal scenario', () => {
      const exams = [
        makeExam('2025-01', { reading: 180, listening: 140 }) // total 320 = target
      ];
      const insight = generateQuickInsight(exams, { targetJapanese: 320, targetComprehensive: 170 });
      expect(insight).not.toBeNull();
    });

    it('detects big improvement', () => {
      const exams = [
        makeExam('2025-01', { reading: 130, listening: 110 }),
        makeExam('2025-02', { reading: 150, listening: 140 }),
      ];
      const insight = generateQuickInsight(exams, { targetJapanese: 320, targetComprehensive: 170 });
      expect(insight).not.toBeNull();
    });

    it('detects high burnout risk', () => {
      const exams = [
        makeExam('2025-01', { reading: 170, listening: 140 }),
        makeExam('2025-02', { reading: 130, listening: 120 }),
        makeExam('2025-03', { reading: 110, listening: 100 }),
      ];
      const insight = generateQuickInsight(exams, { targetJapanese: 320, targetComprehensive: 170 });
      expect(insight).not.toBeNull();
      expect(insight.type).toBe('warning');
    });
  });
});
