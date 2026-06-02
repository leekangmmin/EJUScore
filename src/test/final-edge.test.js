// Copyright (c) 2025 이강민 (Lee Kangmin) — github.com/leekangmmin — MIT License
// ═══════════════════════════════════════════════════════════════════
// Final edge case coverage — remaining uncovered branches
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  weightedWrongListening,
  weightedWrongReading,
  estimateJapaneseScore,
  predictGoalDate,
} from '../utils/scorePrediction';
import { generateQuickInsight, getStudyStreak, detectBurnoutRisk } from '../utils/analytics';
import { generateDailyTasks } from '../utils/taskEngine';

describe('final-edge', () => {
  it('weightedWrongListening filters non-numeric items', () => {
    const r = weightedWrongListening([{ q: -1 }, { q: 0 }, { q: null }, { q: undefined }]);
    expect(r).toBe(0);
  });

  it('difficultyDeduction 0.30-0.50 rate', () => {
    const r = weightedWrongReading([{ q: 5, correctRate: 0.40 }]);
    expect(r).toBeGreaterThan(0);
  });

  it('difficultyDeduction 0.50-0.70 rate', () => {
    const r = weightedWrongReading([{ q: 5, correctRate: 0.60 }]);
    expect(r).toBeGreaterThan(0);
  });

  it('recencyWeight handles non-date string', () => {
    // Indirectly test via estimateJapaneseScore with invalid dates
    const exams = [
      { id: '1', date: 'invalid', examName: 'T1', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [], listening: [] } } },
    ];
    const r = estimateJapaneseScore(exams, [], []);
    expect(r.total).toBeGreaterThan(0);
  });

  it('analytics — burnout with drop=12 (between 11-20)', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 115, listening: 115 } },
      { date: '2025-02', japanese: { reading: 108, listening: 108 } },
      { date: '2025-03', japanese: { reading: 103, listening: 103 } },
    ];
    const r = detectBurnoutRisk(exams);
    expect(r.reasons.some(x => x.includes('하락'))).toBe(true);
  });

  it('analytics — generateQuickInsight with streak >= 3', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100 } },
      { date: '2025-02', japanese: { reading: 100, listening: 100 } },
      { date: '2025-03', japanese: { reading: 100, listening: 100 } },
      { date: '2025-04', japanese: { reading: 100, listening: 100 } },
    ];
    const r = generateQuickInsight(exams, { targetJapanese: 400 });
    expect(r).not.toBeNull();
  });

  it('taskEngine generateDailyTasks with unitErr', () => {
    const exams = [
      { date: '2025-01', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5], listening: [3] } }, comprehensive: { score: 70, mistakes: [{ unit: '경제', errorType: '정보부족' }] } },
      { date: '2025-02', japanese: { reading: 100, listening: 100, wrongQuestions: { reading: [5], listening: [3] } }, comprehensive: { score: 75, mistakes: [{ unit: '경제', errorType: '정보부족' }] } },
    ];
    const tasks = generateDailyTasks(exams);
    expect(tasks.length).toBeGreaterThan(0);
  });
});
