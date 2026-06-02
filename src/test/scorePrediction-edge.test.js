// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Score Prediction — Edge Cases
// Targets: equatingAdjustment (easy/hard), diff compensation, etc.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  estimateJapaneseScore,
  estimateComprehensiveScore,
  predictGoalDate,
  COMP_MAX, JAP_MAX,
} from '../utils/scorePrediction';

describe('scorePrediction.js — edge cases', () => {
  describe('equatingAdjustment (examDifficulty)', () => {
    it('handles easy exam difficulty', () => {
      const exams = [
        { id: '1', date: '2025-01', examName: 'T1', japanese: { reading: 150, listening: 130, wrongQuestions: { reading: [3], listening: [5] } } },
      ];
      const result = estimateJapaneseScore(exams, [3], [5], { examDifficulty: 'easy' });
      expect(result.total).toBeGreaterThan(0);
      expect(result.total).toBeLessThanOrEqual(JAP_MAX);
    });

    it('handles hard exam difficulty', () => {
      const exams = [
        { id: '1', date: '2025-01', examName: 'T1', japanese: { reading: 150, listening: 130, wrongQuestions: { reading: [3], listening: [5] } } },
      ];
      const result = estimateJapaneseScore(exams, [3], [5], { examDifficulty: 'hard' });
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('score at cap boundary', () => {
    it('handles near-perfect reading score', () => {
      const exams = [
        { id: '1', date: '2025-01', examName: 'T1', japanese: { reading: 180, listening: 180, wrongQuestions: { reading: [], listening: [] } } },
        { id: '2', date: '2025-02', examName: 'T2', japanese: { reading: 185, listening: 180, wrongQuestions: { reading: [1], listening: [] } } },
      ];
      const result = estimateJapaneseScore(exams, [], []);
      expect(result.reading).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('estimateComprehensiveScore', () => {
    it('handles 3+ exam history with trend', () => {
      const exams = [
        { date: '2025-01', comprehensive: { score: 60, mistakes: [] } },
        { date: '2025-02', comprehensive: { score: 65, mistakes: [] } },
        { date: '2025-03', comprehensive: { score: 70, mistakes: [] } },
      ];
      const result = estimateComprehensiveScore(exams, []);
      expect(result.score).toBeGreaterThan(0);
    });

    it('handles workbook data with rawMeta', () => {
      const exams = [
        { date: '2025-01', recordType: 'workbook', comprehensive: { score: 40, rawMeta: { isRaw: true, max: 50 }, mistakes: [] } },
      ];
      const result = estimateComprehensiveScore(exams, []);
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('predictGoalDate edge cases', () => {
    it('handles already achieved target', () => {
      const extractor = (e) => e.comprehensive?.score;
      const exams = [
        { date: '2025-01', comprehensive: { score: 80 } },
        { date: '2025-02', comprehensive: { score: 90 } },
      ];
      const result = predictGoalDate(exams, 85, extractor);
      expect(result.alreadyAchieved).toBe(true);
    });

    it('handles single exam (returns null)', () => {
      const extractor = (e) => e.comprehensive?.score;
      const exams = [{ date: '2025-01', comprehensive: { score: 80 } }];
      expect(predictGoalDate(exams, 200, extractor)).toBeNull();
    });

    it('handles zero denom (all same scores)', () => {
      const extractor = (e) => e.comprehensive?.score;
      const exams = [
        { date: '2025-01', comprehensive: { score: 75 } },
        { date: '2025-02', comprehensive: { score: 75 } },
        { date: '2025-03', comprehensive: { score: 75 } },
      ];
      const result = predictGoalDate(exams, 200, extractor);
      expect(result).toBeNull();
    });
  });

  describe('estimateJapaneseScore edge cases', () => {
    it('handles difficultyOverrides', () => {
      const exams = [
        { id: '1', date: '2025-01', examName: 'T1', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [23], listening: [] } } },
      ];
      const result = estimateJapaneseScore(exams, [23], [], { difficultyOverrides: { 23: 'hard' } });
      expect(result.total).toBeGreaterThan(0);
    });
  });
});
