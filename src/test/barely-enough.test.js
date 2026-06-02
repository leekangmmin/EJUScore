// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Barely enough — hitting remaining uncovered statements
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { getStudyStreak } from '../utils/analytics';
import { estimateComprehensiveScore, weightedWrongListening } from '../utils/scorePrediction';

describe('barely-enough', () => {
  it('getStudyStreak with month gap > 1 (break streak)', () => {
    // Jan and March have gap of 2 months, so streak resets
    const exams = [
      { date: '2025-01-01', japanese: { reading: 100, listening: 100 } },
      { date: '2025-03-01', japanese: { reading: 110, listening: 110 } },
    ];
    const r = getStudyStreak(exams);
    expect(r.current).toBe(1);
  });

  it('weightedWrongListening with non-numeric items', () => {
    const r = weightedWrongListening([{ q: 'abc' }]);
    expect(r).toBe(0);
  });

  it('estimateComprehensiveScore with questionNumber in mistakes', () => {
    // This hits setFromMistakes with questionNumber
    const exams = [
      { date: '2025-01', comprehensive: { score: 80, mistakes: [{ questionNumber: 5, unit: '경제', errorType: '정보부족' }] } },
    ];
    const r = estimateComprehensiveScore(exams, [{ questionNumber: 5 }]);
    expect(r.score).toBeGreaterThan(0);
  });
});
