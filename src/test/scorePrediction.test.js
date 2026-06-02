// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Score Prediction Unit Tests
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  estimateJapaneseScore,
  estimateComprehensiveScore,
  weightedWrongReading,
  weightedWrongListening,
  confidenceLabel,
} from '../utils/scorePrediction';

describe('scorePrediction.js', () => {
  describe('confidenceLabel', () => {
    it('returns 높음 for high scores', () => {
      expect(confidenceLabel(0.85)).toBe('높음');
    });
    it('returns 보통 for medium scores', () => {
      expect(confidenceLabel(0.6)).toBe('보통');
    });
    it('returns 낮음 for low scores', () => {
      expect(confidenceLabel(0.3)).toBe('낮음');
    });
  });

  describe('weightedWrongReading', () => {
    it('returns 0 for empty array', () => {
      expect(weightedWrongReading([])).toBe(0);
    });

    it('calculates weighted wrong for simple array', () => {
      const result = weightedWrongReading([1, 2, 3]);
      expect(result).toBeGreaterThan(0);
      expect(result).toBe(3);
    });

    it('applies difficulty override for hard questions', () => {
      const result = weightedWrongReading([23], {});
      expect(result).toBeLessThan(1.0);
      expect(result).toBe(0.45);
    });

    it('handles object items with correctRate', () => {
      const result = weightedWrongReading([
        { q: 1, correctRate: 0.2 },
        { q: 5, correctRate: 0.8 },
      ]);
      // Q1 hard (correctRate 0.2): 0.5 * 1.0 = 0.5
      // Q5 easy (correctRate 0.8): 1.0 * 1.0 = 1.0
      expect(result).toBeCloseTo(1.5, 1);
    });
  });

  describe('weightedWrongListening', () => {
    it('returns 0 for empty array', () => {
      expect(weightedWrongListening([])).toBe(0);
    });

    it('calculates weighted wrong for standard questions', () => {
      expect(weightedWrongListening([1, 2, 3])).toBe(3);
    });
  });

  describe('estimateJapaneseScore', () => {
    it('returns prediction with default options', () => {
      const result = estimateJapaneseScore([], [], []);
      expect(result).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
      expect(result.total).toBeLessThanOrEqual(370);
      expect(result.reading).toBeDefined();
      expect(result.listening).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('predicts higher score for fewer wrong answers', () => {
      const exams = [
        { id: '1', date: '2025-06', japanese: { reading: 150, listening: 140 } },
      ];
      const good = estimateJapaneseScore(exams, [], []);
      expect(good.reading).toBeGreaterThanOrEqual(100);
    });
  });

  describe('estimateComprehensiveScore', () => {
    it('returns default score for no data', () => {
      const result = estimateComprehensiveScore([], []);
      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
    });
  });
});
