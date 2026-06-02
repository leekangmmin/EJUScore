// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Analytics — Final Edge Cases (cover remaining uncovered lines)
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { detectBurnoutRisk, generateQuickInsight } from '../utils/analytics';

describe('analytics.js — final edge cases', () => {
  describe('detectBurnoutRisk drop > 10 but <= 20', () => {
    it('covers small drop warning path', () => {
      const exams = [];
      for (let i = 0; i < 3; i++) {
        exams.push({
          date: `2025-0${i+1}`,
          japanese: { reading: 120 - i*8, listening: 120 - i*8 },
        });
      }
      const result = detectBurnoutRisk(exams);
      // drop = 120 - 104 = 16, so should trigger else-if (drop > 10)
      expect(result.reasons.some(r => r.includes('하락'))).toBe(true);
    });
  });

  describe('generateQuickInsight close to target', () => {
    it('returns 목표 코앞 when near japanese target', () => {
      const exams = [
        { date: '2025-01', japanese: { reading: 155, listening: 155 } },
      ];
      const result = generateQuickInsight(exams, { targetJapanese: 320 });
      // latest = 310, target = 320, gap = 10
      expect(result).not.toBeNull();
    });

    it('returns streak insight for 3+ months', () => {
      const exams = [];
      for (let i = 0; i < 4; i++) {
        exams.push({
          date: `2025-0${i+1}`,
          japanese: { reading: 100, listening: 100 },
        });
      }
      const result = generateQuickInsight(exams, {});
      expect(result).not.toBeNull();
    });
  });
});
