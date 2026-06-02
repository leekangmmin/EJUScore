// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Score Prediction — Extended Coverage
// Targets: edge cases, confidenceLabel, equatingAdjustment, 
//          weightedWrongReading, weightedWrongListening, trendBasedPrediction
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  confidenceLabel,
  weightedWrongReading,
  weightedWrongListening,
  estimateJapaneseScore,
} from '../utils/scorePrediction';

describe('scorePrediction.js — extended', () => {
  describe('confidenceLabel', () => {
    it('returns 높음 for high scores', () => {
      expect(confidenceLabel(0.85)).toBe('높음');
      expect(confidenceLabel(0.78)).toBe('높음');
    });

    it('returns 보통 for medium scores', () => {
      expect(confidenceLabel(0.65)).toBe('보통');
      expect(confidenceLabel(0.52)).toBe('보통');
    });

    it('returns 낮음 for low scores', () => {
      expect(confidenceLabel(0.3)).toBe('낮음');
      expect(confidenceLabel(0.51)).toBe('낮음');
    });
  });

  describe('weightedWrongReading', () => {
    it('returns 0 for empty array', () => {
      expect(weightedWrongReading([])).toBe(0);
    });

    it('handles simple number array', () => {
      const result = weightedWrongReading([1, 5, 10]);
      expect(result).toBeGreaterThan(0);
    });

    it('handles object items with correctRate', () => {
      const result = weightedWrongReading([
        { q: 5, correctRate: 0.2 },   // hard question, less deduction
        { q: 10, correctRate: 0.9 },  // easy question, full deduction
      ]);
      expect(result).toBeGreaterThan(0);
    });

    it('handles teacherHard flag', () => {
      const result = weightedWrongReading([
        { q: 5, teacherHard: true },
      ]);
      expect(result).toBeGreaterThan(0);
    });

    it('ignores invalid questions', () => {
      expect(weightedWrongReading([0, -1, null, undefined])).toBe(0);
    });
  });

  describe('weightedWrongListening', () => {
    it('returns 0 for empty array', () => {
      expect(weightedWrongListening([])).toBe(0);
    });

    it('handles object items with correctRate', () => {
      const result = weightedWrongListening([
        { q: 3, correctRate: 0.3 },
        { q: 15, correctRate: 0.8 },
      ]);
      expect(result).toBeGreaterThan(0);
    });

    it('handles difficulty overrides', () => {
      const result = weightedWrongListening([3, 15], { 3: 'hard' });
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('estimateJapaneseScore', () => {
    it('returns reasonable predictions with sample data', () => {
      const exams = [
        { id: '1', date: '2025-01', examName: 'Test1', japanese: { reading: 150, listening: 130, wrongQuestions: { reading: [3, 7], listening: [5, 15] } } },
        { id: '2', date: '2025-02', examName: 'Test2', japanese: { reading: 155, listening: 135, wrongQuestions: { reading: [3], listening: [5] } } },
      ];
      const result = estimateJapaneseScore(exams, [3, 7], [5, 15]);
      expect(result).toBeDefined();
      expect(result.total).toBeDefined();
      expect(result.reading).toBeDefined();
      expect(result.listening).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
      expect(result.total).toBeLessThanOrEqual(370);
    });

    it('returns fallback for no history', () => {
      const result = estimateJapaneseScore([], [], []);
      expect(result).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
    });

    it('handles workbook history', () => {
      const exams = [
        { id: '1', date: '2025-01', examName: 'Test1', recordType: 'workbook', japanese: { reading: 100, listening: 100, rawMeta: { isRaw: true, readingMax: 25, listeningMax: 40 }, wrongQuestions: { reading: [1, 2], listening: [1] } } },
      ];
      const result = estimateJapaneseScore(exams, [1], [1]);
      expect(result).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
    });
  });
});
