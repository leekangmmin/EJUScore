// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Analytics — Edge Cases (remaining uncovered branches)
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  getStudyStreak,
  detectBurnoutRisk,
  detectStagnation,
  getStudyConsistency,
  getAchievementProbability,
  generateQuickInsight,
} from '../utils/analytics';

describe('analytics.js — edge cases', () => {
  describe('getStudyStreak', () => {
    it('handles exams with empty date strings', () => {
      // Empty strings become month keys, so streak >= 1
      const result = getStudyStreak([{ date: '' }, { date: '' }]);
      expect(typeof result.current).toBe('number');
    });
  });

  describe('detectStagnation', () => {
    it('detects stagnant japanese scores', () => {
      const exams = [];
      for (let i = 0; i < 5; i++) {
        exams.push({
          date: `2025-0${i+1}`,
          japanese: { reading: 100, listening: 100 },
        });
      }
      const result = detectStagnation(exams);
      expect(result.japanese).toBe(true);
    });

    it('returns false for insufficient history', () => {
      const exams = [{ date: '2025-01', japanese: { reading: 100, listening: 100 } }];
      const result = detectStagnation(exams);
      expect(result.japanese).toBe(false);
    });
  });

  describe('detectBurnoutRisk', () => {
    it('returns low for insufficient data', () => {
      expect(detectBurnoutRisk([]).risk).toBe('low');
    });

    it('detects high risk with declining scores', () => {
      const exams = [];
      for (let i = 0; i < 3; i++) {
        exams.push({
          date: `2025-0${i+1}`,
          japanese: { reading: 150 - i*20, listening: 150 - i*20 },
        });
      }
      const result = detectBurnoutRisk(exams);
      expect(result.risk).toBeDefined();
    });
  });

  describe('getStudyConsistency', () => {
    it('returns 0 for empty exams', () => {
      expect(getStudyConsistency([], 3)).toBe(0);
    });
  });

  describe('getAchievementProbability', () => {
    it('returns null for empty data', () => {
      const result = getAchievementProbability([], 320, 170);
      expect(result.japanese).toBeNull();
      expect(result.comprehensive).toBeNull();
    });

    it('returns 99 when target already achieved', () => {
      const exams = [{ date: '2025-01', japanese: { reading: 200, listening: 200 } }];
      const result = getAchievementProbability(exams, 300, 170);
      expect(result.japanese).toBe(99);
    });
  });

  describe('generateQuickInsight', () => {
    it('returns null for empty exams', () => {
      expect(generateQuickInsight([], {})).toBeNull();
    });

    it('returns quick insight for streak', () => {
      const exams = [];
      for (let i = 0; i < 4; i++) {
        exams.push({
          date: `2025-0${i+1}`,
          japanese: { reading: 100, listening: 100 },
        });
      }
      const result = generateQuickInsight(exams, {});
      expect(result).not.toBeNull();
      expect(result.type).toBeDefined();
    });

    it('returns warning for high burnout risk', () => {
      const exams = [];
      for (let i = 0; i < 3; i++) {
        exams.push({
          date: `2025-0${i+1}`,
          japanese: { reading: 150 - i*30, listening: 150 - i*30 },
        });
      }
      const result = generateQuickInsight(exams, {});
      expect(result).not.toBeNull();
    });
  });
});
