// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Score Prediction — Additional Coverage
// Targets: estimateComprehensiveScore, predictGoalDate
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  estimateComprehensiveScore,
  predictGoalDate,
  COMP_MAX,
} from '../utils/scorePrediction';

describe('scorePrediction.js — additional', () => {
  describe('estimateComprehensiveScore', () => {
    it('handles empty exams', () => {
      const result = estimateComprehensiveScore([], []);
      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('returns prediction with exam data', () => {
      const exams = [
        {
          date: '2025-01-10',
          comprehensive: { score: 75, mistakes: [{ unit: 'economy', errorType: 'concept' }] },
        },
        {
          date: '2025-02-14',
          comprehensive: { score: 82, mistakes: [{ unit: 'history', errorType: 'fact' }] },
        },
        {
          date: '2025-03-20',
          comprehensive: { score: 88, mistakes: [{ unit: 'geography', errorType: 'map' }] },
        },
      ];
      const mistakes = [{ unit: 'economy', errorType: 'concept' }];
      const result = estimateComprehensiveScore(exams, mistakes);
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(COMP_MAX);
      expect(result.confidence).toBeDefined();
    });

    it('handles workbook history with rawMeta', () => {
      const exams = [
        {
          date: '2025-01-10',
          recordType: 'workbook',
          comprehensive: {
            score: 30,
            rawMeta: { isRaw: true, max: 50 },
            mistakes: [],
          },
        },
      ];
      const result = estimateComprehensiveScore(exams, []);
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('predictGoalDate', () => {
    const extractor = (e) => e?.comprehensive?.score;

    it('returns null for less than 2 exams', () => {
      const exams = [{ date: '2025-01', comprehensive: { score: 80 } }];
      expect(predictGoalDate(exams, 200, extractor)).toBeNull();
    });

    it('returns null for empty exams', () => {
      expect(predictGoalDate([], 200, extractor)).toBeNull();
    });

    it('returns alreadyAchieved when score >= target', () => {
      const exams = [
        { date: '2025-01', comprehensive: { score: 80 } },
        { date: '2025-02', comprehensive: { score: 90 } },
      ];
      const result = predictGoalDate(exams, 85, extractor);
      expect(result.alreadyAchieved).toBe(true);
      expect(result.monthsAhead).toBe(0);
    });

    it('returns prediction for improving scores', () => {
      const exams = [
        { date: '2025-01', comprehensive: { score: 60 } },
        { date: '2025-02', comprehensive: { score: 65 } },
        { date: '2025-03', comprehensive: { score: 70 } },
        { date: '2025-04', comprehensive: { score: 75 } },
      ];
      const result = predictGoalDate(exams, 150, extractor);
      expect(result).not.toBeNull();
      expect(result.monthsAhead).toBeGreaterThan(0);
      expect(result.alreadyAchieved).toBe(false);
    });

    it('returns null when slope is zero (no improvement)', () => {
      const exams = [
        { date: '2025-01', comprehensive: { score: 70 } },
        { date: '2025-02', comprehensive: { score: 70 } },
      ];
      const result = predictGoalDate(exams, 200, extractor);
      expect(result).toBeNull();
    });

    it('returns null when k is out of range', () => {
      const exams = [
        { date: '2025-01', comprehensive: { score: 30 } },
        { date: '2025-02', comprehensive: { score: 35 } },
      ];
      const result = predictGoalDate(exams, 999, extractor);
      expect(result).toBeNull();
    });

    it('handles extractor returning null scores', () => {
      const nullExtractor = () => null;
      const exams = [
        { date: '2025-01', comprehensive: { score: null } },
        { date: '2025-02', comprehensive: { score: null } },
      ];
      expect(predictGoalDate(exams, 200, nullExtractor)).toBeNull();
    });
  });
});
