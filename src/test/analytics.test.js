// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Analytics Unit Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  getStudyStreak,
  getStudyConsistency,
  detectStagnation,
  detectBurnoutRisk,
  getAchievementProbability,
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

describe('analytics.js', () => {
  describe('getStudyStreak', () => {
    it('returns zeros for empty exams', () => {
      const s = getStudyStreak([]);
      expect(s.current).toBe(0);
      expect(s.best).toBe(0);
    });

    it('counts consecutive months', () => {
      const exams = [
        makeExam('2025-01', { reading: 100, listening: 100 }),
        makeExam('2025-02', { reading: 110, listening: 100 }),
        makeExam('2025-03', { reading: 120, listening: 100 }),
      ];
      const s = getStudyStreak(exams);
      expect(s.current).toBe(3);
      expect(s.best).toBe(3);
    });

    it('breaks streak on gap', () => {
      const exams = [
        makeExam('2025-01', { reading: 100, listening: 100 }),
        makeExam('2025-02', { reading: 110, listening: 100 }),
        makeExam('2025-04', { reading: 120, listening: 100 }), // gap
      ];
      const s = getStudyStreak(exams);
      expect(s.current).toBe(1);
      expect(s.best).toBe(2);
    });
  });

  describe('getStudyConsistency', () => {
    it('returns 0 for empty exams', () => {
      expect(getStudyConsistency([], 3)).toBe(0);
    });
  });

  describe('detectStagnation', () => {
    it('returns false for insufficient data', () => {
      const s = detectStagnation([makeExam('2025-01', { reading: 100, listening: 100 })]);
      expect(s.japanese).toBe(false);
    });

    it('detects stagnant scores', () => {
      const exams = [
        makeExam('2025-01', { reading: 100, listening: 100 }),
        makeExam('2025-02', { reading: 101, listening: 100 }),
        makeExam('2025-03', { reading: 100, listening: 101 }),
        makeExam('2025-04', { reading: 102, listening: 100 }),
      ];
      const s = detectStagnation(exams, 8, 4);
      expect(s.japanese).toBe(true);
    });
  });

  describe('detectBurnoutRisk', () => {
    it('returns low risk for insufficient data', () => {
      const r = detectBurnoutRisk([makeExam('2025-01', { reading: 100, listening: 100 })]);
      expect(r.risk).toBe('low');
    });

    it('detects high risk on score drop', () => {
      const exams = [
        makeExam('2025-01', { reading: 160, listening: 140 }),
        makeExam('2025-02', { reading: 130, listening: 120 }),
        makeExam('2025-03', { reading: 110, listening: 100 }),
      ];
      const r = detectBurnoutRisk(exams);
      expect(r.risk).toBe('high');
    });
  });

  describe('getAchievementProbability', () => {
    it('returns null for empty data', () => {
      const p = getAchievementProbability([], 320, 170);
      expect(p.japanese).toBeNull();
      expect(p.comprehensive).toBeNull();
    });

    it('returns high probability when target met', () => {
      const exams = [makeExam('2025-01', { reading: 180, listening: 180 }, 190)];
      const p = getAchievementProbability(exams, 320, 170);
      expect(p.japanese).toBe(99);
    });
  });
});
